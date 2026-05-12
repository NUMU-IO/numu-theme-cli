import { Command } from "commander";
import { execSync } from "child_process";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { loadConfig } from "../utils/config";
import { validateTheme } from "../utils/validator";
import { zipDirectory } from "../utils/zipper";
import { apiRequest, uploadFile } from "../utils/api";

interface UploadResponse {
  build_id?: string;
  source_zip_path?: string;
}

interface VersionResponse {
  version_id: string;
  status: string;
}

interface VersionStatus {
  version_id: string;
  status: string;
  build_log?: string | null;
  bundle_url?: string | null;
}

interface InstallResponse {
  installation_id: string;
  marketplace_theme_id: string;
  marketplace_version_id: string;
  version_string: string;
  version_status: string;
  is_active: boolean;
  is_developer_install: boolean;
}

/**
 * Build, upload, and install the developer's theme on one of their
 * own stores in a single command — bypassing marketplace review.
 *
 * Flow:
 *   1. Validate the project (same checks `numu-theme submit` runs).
 *   2. ZIP the source + upload via `POST /themes/upload`.
 *   3. Submit a version against the developer's listing.
 *   4. Poll the build status until it's built (`bundle_url` set) OR
 *      `build_failed` (surface log + exit non-zero).
 *   5. Call the developer-install endpoint on the target store —
 *      installs + activates.
 *
 * Usage:
 *   numu-theme install --theme-id <listing_uuid> --store <store_uuid>
 *
 * Why this exists vs `numu-theme submit`:
 *   `submit` ends at "version is pending review" — admin still has to
 *   approve before it's installable on any store. `install` is for
 *   the developer's own dogfood loop: ship the latest local code to
 *   their staging/test store immediately, on their own authority.
 */
export const installCommand = new Command("install")
  .description(
    "Build + upload + install a theme directly on a store you own (bypasses marketplace review)",
  )
  .option("-d, --dir <directory>", "Theme directory", ".")
  .requiredOption(
    "-t, --theme-id <theme_id>",
    "Marketplace theme listing UUID (create via dashboard first)",
  )
  .requiredOption(
    "-s, --store <store_id>",
    "Store UUID to install on. Falls back to the configured store_id when omitted.",
  )
  .option(
    "--poll-timeout <seconds>",
    "How long to wait for the build to finish (default: 240)",
    "240",
  )
  .option(
    "--poll-interval <seconds>",
    "How often to poll build status (default: 4)",
    "4",
  )
  .option("-n, --notes <notes>", "Release notes for this version")
  .action(
    async (options: {
      dir: string;
      themeId: string;
      store?: string;
      pollTimeout: string;
      pollInterval: string;
      notes?: string;
    }) => {
      const config = loadConfig();
      if (!config.token) {
        console.error("Not logged in. Run: numu-theme login");
        process.exit(1);
      }

      const storeId = options.store || config.store_id;
      if (!storeId) {
        console.error(
          "No store specified. Pass --store <id> or set store_id in your config.",
        );
        process.exit(1);
      }

      // ── Step 1: validate ────────────────────────────────────────────────
      console.log("Validating theme...");
      const result = validateTheme(options.dir);
      if (!result.valid) {
        console.error("Theme has validation errors. Fix these first:");
        result.errors.forEach((e) => console.error(`  ✗ ${e}`));
        process.exit(1);
      }
      result.warnings.forEach((w) => console.log(`  ⚠ ${w}`));

      // Single source of truth: read version from theme.json (the
      // build worker validates against it). package.json is irrelevant
      // for our purposes — npm-side semver is for the dev's tooling
      // only. Submit a `-dev.<timestamp>` suffix so each install is
      // unique against the (theme_id, version_string) UNIQUE index
      // without forcing the developer to bump versions by hand on
      // every iteration.
      const themeJsonPath = path.join(options.dir, "theme.json");
      let baseVersion: string | undefined;
      try {
        const tj = JSON.parse(fs.readFileSync(themeJsonPath, "utf-8"));
        baseVersion = tj.version;
      } catch {
        console.error("Cannot read theme.json from theme directory.");
        process.exit(1);
      }
      if (!baseVersion) {
        console.error("theme.json has no `version` field.");
        process.exit(1);
      }
      // Compact ISO timestamp without separators — short enough not to
      // bloat URLs / version columns, sortable, deterministic enough
      // that two installs in the same second still get unique values
      // (the random tail breaks the tie). Backend's worker treats
      // `<base>-dev.<X>` as a valid build of `<base>` (relaxed match).
      const stamp =
        new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z") +
        "-" +
        Math.random().toString(36).slice(2, 6);
      const version = `${baseVersion}-dev.${stamp}`;
      console.log(`  base version: ${baseVersion}`);
      console.log(`  install tag:  ${version}`);

      // ── Step 2: build locally + package ─────────────────────────────────
      // Why build here instead of letting the worker do it: the dev
      // env uses pnpm/npm-link to wire @numu/theme-sdk + theme-plugin
      // as workspace dependencies (`link:../numu-theme-sdk`). The
      // build worker can't resolve those — npm doesn't even understand
      // the `link:` protocol — so its own `npm install` fails with
      // EUNSUPPORTEDPROTOCOL. We sidestep that by building here, where
      // the workspace resolution Just Works, and shipping the dist/
      // in the ZIP. The worker detects a pre-built dist and uploads
      // it directly. Marketplace `submit` keeps the rebuild-from-source
      // path so we can still vet third-party code on a clean machine.
      console.log("Building locally (so worker can skip npm install)...");
      try {
        execSync("npm run build", {
          cwd: options.dir,
          stdio: "inherit",
          env: { ...process.env, NODE_ENV: "production" },
        });
      } catch {
        console.error(
          "\nLocal build failed. Fix the build errors above before running install again.",
        );
        process.exit(1);
      }
      const distEntry = path.join(options.dir, "dist", "theme.js");
      if (!fs.existsSync(distEntry)) {
        console.error(
          "\nBuild completed but dist/theme.js is missing. Check vite.config.ts entry / output filename.",
        );
        process.exit(1);
      }

      console.log("Packaging source + dist...");
      const zipPath = path.join(
        os.tmpdir(),
        `numu-theme-install-${Date.now()}.zip`,
      );
      await zipDirectory(options.dir, zipPath, { includeDist: true });

      console.log("Uploading...");
      // queue_build=false: we don't want /themes/upload's auto-build
      // (which deletes the ZIP after building) to run. The marketplace
      // submit_version pipeline below has its own builder that needs
      // the ZIP to still be on disk.
      const uploadRes = await uploadFile<UploadResponse>(
        "/themes/upload?queue_build=false",
        zipPath,
      );
      if (uploadRes.status >= 300) {
        console.error(
          `Upload failed (${uploadRes.status}): ${JSON.stringify(uploadRes.data)}`,
        );
        process.exit(1);
      }
      const sourceZipPath = uploadRes.data?.source_zip_path;
      if (!sourceZipPath) {
        console.error(
          "Upload response missing `source_zip_path`. Backend out of date?",
        );
        process.exit(1);
      }

      // ── Step 3: submit version ──────────────────────────────────────────
      console.log(`Submitting version ${version}...`);
      const submitRes = await apiRequest<VersionResponse>(
        "POST",
        `/marketplace/developer/themes/${encodeURIComponent(options.themeId)}/versions`,
        {
          version_string: version,
          source_zip_path: sourceZipPath,
          release_notes: options.notes ?? null,
        },
      );
      if (submitRes.status !== 200 && submitRes.status !== 202) {
        console.error(
          `Submit failed (${submitRes.status}): ${JSON.stringify(submitRes.data)}`,
        );
        process.exit(1);
      }
      const versionId = submitRes.data.version_id;
      console.log(`  version_id: ${versionId}`);

      // ── Step 4: poll until built ────────────────────────────────────────
      // We accept any status whose build emitted a bundle_url. That's
      // typically `pending_review`, `approved`, or `published` — the
      // developer-install backend method will pick whichever is latest
      // with a bundle. Build_failed exits the loop with the build log.
      const timeoutMs = Math.max(60, parseInt(options.pollTimeout, 10) || 240) * 1000;
      const intervalMs = Math.max(2, parseInt(options.pollInterval, 10) || 4) * 1000;
      const deadline = Date.now() + timeoutMs;
      console.log("Waiting for build...");

      let lastStatus = "";
      while (Date.now() < deadline) {
        const statusRes = await apiRequest<VersionStatus>(
          "GET",
          `/marketplace/developer/versions/${encodeURIComponent(versionId)}/status`,
        );
        if (statusRes.status >= 300) {
          console.error(
            `  status check failed (${statusRes.status}): ${JSON.stringify(statusRes.data)}`,
          );
          process.exit(1);
        }
        const s = statusRes.data;
        if (s.status !== lastStatus) {
          console.log(`  ${s.status}`);
          lastStatus = s.status;
        }
        if (s.bundle_url) break;
        if (s.status === "build_failed") {
          console.error("\nBuild failed.");
          if (s.build_log) {
            console.error("--- build log (tail) ---");
            // Build logs can be long — show last 60 lines so the
            // terminal doesn't drown the user.
            const tail = s.build_log.split("\n").slice(-60).join("\n");
            console.error(tail);
            console.error("--- end log ---");
          }
          process.exit(1);
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }

      if (Date.now() >= deadline) {
        console.error(
          `\nTimed out waiting for build (${options.pollTimeout}s). ` +
            `Run \`numu-theme status --version ${versionId}\` to keep watching.`,
        );
        process.exit(1);
      }

      // ── Step 5: developer-install on the store ──────────────────────────
      console.log(`Installing on store ${storeId}...`);
      const installRes = await apiRequest<InstallResponse>(
        "POST",
        `/stores/${encodeURIComponent(storeId)}/marketplace/developer-install/${encodeURIComponent(options.themeId)}`,
        {},
      );
      if (installRes.status >= 300) {
        console.error(
          `Install failed (${installRes.status}): ${JSON.stringify(installRes.data)}`,
        );
        process.exit(1);
      }

      // The developer-install path doesn't auto-activate (lets the
      // merchant choose). For CLI convenience we kick activate too —
      // the dev clearly wants this theme live on their test store.
      const activateRes = await apiRequest<unknown>(
        "POST",
        `/stores/${encodeURIComponent(storeId)}/marketplace/activate`,
        { marketplace_theme_id: options.themeId },
      );
      if (activateRes.status >= 300) {
        console.warn(
          `  Installed but activation returned ${activateRes.status}. Visit the dashboard to activate.`,
        );
      }

      console.log("\n✓ Installed and activated on your store.");
      console.log(
        `  installation_id: ${installRes.data.installation_id}`,
      );
      console.log(`  version: ${installRes.data.version_string}`);
      console.log(`  version_status: ${installRes.data.version_status}`);
    },
  );
