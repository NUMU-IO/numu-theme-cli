import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { apiRequest } from "../utils/api";

/**
 * Pull the source ZIP of a published marketplace theme down to a
 * local directory — Phase 7.7.
 *
 * The backend's marketplace version row stores `source_zip_path`
 * pointing at the upload the developer pushed when they submitted
 * the version. This command resolves that URL and unpacks it locally,
 * so a dev can edit and re-push without recreating the project from
 * scratch.
 *
 * Only the theme's owning developer can pull. The backend authorizes
 * via the bearer token (same as `push`/`submit`).
 *
 * Usage:
 *   numu-theme pull <theme-id>                  → into ./<theme-id>
 *   numu-theme pull <theme-id> --dir my-theme   → into ./my-theme
 *   numu-theme pull <theme-id> --version 1.2.0  → specific version
 *                                                  (default: latest)
 *   numu-theme pull <theme-id> --force          → overwrite existing
 */

interface ThemeMeta {
  id: string;
  slug?: string;
  name?: string;
  latest_version?: string | null;
}

interface VersionMeta {
  id: string;
  version_string: string;
  source_zip_path?: string | null;
  bundle_url?: string | null;
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(url, (res) => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        // Follow one level of redirect — R2 + Cloudflare Images often
        // return 302 to a signed URL.
        downloadToFile(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on("finish", () => out.close(() => resolve()));
      out.on("error", reject);
    });
    req.on("error", reject);
  });
}

async function unzip(zipPath: string, targetDir: string): Promise<void> {
  // We use the `tar` binary on Windows 10+ (1809+ ships bsdtar that
  // handles zip natively) and `unzip` on Unix. Keeps dependencies
  // minimal — adding a Node zip lib for this single command is
  // overkill.
  const { execFileSync } = await import("child_process");
  fs.mkdirSync(targetDir, { recursive: true });
  if (process.platform === "win32") {
    execFileSync("tar", ["-xf", zipPath, "-C", targetDir], {
      stdio: "inherit",
    });
  } else {
    execFileSync("unzip", ["-q", zipPath, "-d", targetDir], {
      stdio: "inherit",
    });
  }
}

export const pullCommand = new Command("pull")
  .description("Download a published theme's source to a local directory")
  .argument("<theme-id>", "Theme slug or UUID")
  .option(
    "-d, --dir <directory>",
    "Target directory (default: ./<theme-id>)",
  )
  .option(
    "-v, --version <version>",
    "Specific version_string (default: latest)",
  )
  .option("--force", "Overwrite the target directory if it exists")
  .action(
    async (
      themeId: string,
      options: { dir?: string; version?: string; force?: boolean },
    ) => {
      const targetDir = path.resolve(options.dir || themeId);
      if (fs.existsSync(targetDir) && !options.force) {
        const isEmpty = fs.readdirSync(targetDir).length === 0;
        if (!isEmpty) {
          console.error(
            `Target directory ${targetDir} is not empty. Re-run with --force to overwrite.`,
          );
          process.exit(1);
        }
      }

      // 1. Resolve the theme + its versions via the marketplace API.
      //    Endpoint already exists at /marketplace/themes/{theme_id}.
      console.log(`Resolving theme ${themeId}…`);
      const themeRes = await apiRequest<ThemeMeta>(
        "GET",
        `/api/v1/marketplace/themes/${encodeURIComponent(themeId)}`,
      );
      if (themeRes.status !== 200) {
        console.error(
          `Theme not found (HTTP ${themeRes.status}). Double-check the slug or UUID.`,
        );
        process.exit(1);
      }
      const theme = themeRes.data;

      // 2. Pick the version to pull. Prefer --version, else latest.
      const versionsRes = await apiRequest<VersionMeta[]>(
        "GET",
        `/api/v1/marketplace/themes/${encodeURIComponent(themeId)}/versions`,
      );
      if (versionsRes.status !== 200) {
        console.error(
          `Couldn't list versions (HTTP ${versionsRes.status}).`,
        );
        process.exit(1);
      }
      const versions = versionsRes.data;
      const target = options.version
        ? versions.find((v) => v.version_string === options.version)
        : versions[0];
      if (!target) {
        console.error(
          options.version
            ? `No version "${options.version}" found for this theme.`
            : "No versions published for this theme yet.",
        );
        process.exit(1);
      }

      if (!target.source_zip_path) {
        console.error(
          `Version ${target.version_string} has no source ZIP — pull is only available for versions submitted with a ZIP upload (post-Phase 7).`,
        );
        process.exit(1);
      }

      // 3. Download the ZIP to a temp file, then unpack into target.
      console.log(`Downloading ${theme.name || themeId} ${target.version_string}…`);
      const tmpZip = path.join(
        require("os").tmpdir(),
        `numu-pull-${process.pid}-${Date.now()}.zip`,
      );
      try {
        await downloadToFile(target.source_zip_path, tmpZip);
        console.log(`Unpacking into ${targetDir}…`);
        fs.rmSync(targetDir, { recursive: true, force: true });
        await unzip(tmpZip, targetDir);
      } finally {
        if (fs.existsSync(tmpZip)) {
          fs.unlinkSync(tmpZip);
        }
      }

      console.log(`✔ Pulled ${theme.slug || themeId}@${target.version_string} into ${targetDir}`);
      console.log("");
      console.log("Next steps:");
      console.log(`  cd ${path.relative(process.cwd(), targetDir) || "."}`);
      console.log("  npm install");
      console.log("  numu-theme dev");
    },
  );
