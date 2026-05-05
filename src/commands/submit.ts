import { Command } from "commander";
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

/**
 * Submit a theme to the marketplace for review.
 *
 * Backend contract is two-step:
 *   1. Upload ZIP via `POST /themes/upload` → returns { build_id, source_zip_path }.
 *   2. POST `/marketplace/developer/themes/{theme_id}/versions` with
 *      `{ version_string, source_zip_path, release_notes }`.
 *
 * The CLI consumes those two endpoints; the user picks which existing
 * marketplace theme listing to submit a new version against (`--theme-id`),
 * or creates a new listing first via the dashboard.
 */
export const submitCommand = new Command("submit")
  .description("Submit theme to the NUMU Marketplace for review")
  .option("-d, --dir <directory>", "Theme directory", ".")
  .requiredOption(
    "-t, --theme-id <theme_id>",
    "Marketplace theme listing UUID (create via dashboard first)",
  )
  .option("-n, --notes <notes>", "Release notes for this version")
  .action(
    async (options: { dir: string; themeId: string; notes?: string }) => {
      const config = loadConfig();
      if (!config.token) {
        console.error("Not logged in. Run: numu-theme login");
        process.exit(1);
      }

      console.log("Running full validation...");
      const result = validateTheme(options.dir);
      if (!result.valid) {
        console.error(
          "Theme must pass all validations before marketplace submission.",
        );
        result.errors.forEach((e) => console.error(`  ✗ ${e}`));
        process.exit(1);
      }
      if (result.warnings.length > 0) {
        console.log("\nWarnings:");
        result.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
      }

      // Read the version from the theme's package.json — the developer's
      // local source of truth — so what we submit always matches what
      // they versioned.
      const pkgPath = path.join(options.dir, "package.json");
      let version: string | undefined;
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        version = pkg.version;
      } catch {
        console.error("Cannot read package.json from theme directory.");
        process.exit(1);
      }
      if (!version) {
        console.error("package.json has no `version` field.");
        process.exit(1);
      }

      console.log("\nPackaging theme source...");
      const zipPath = path.join(
        os.tmpdir(),
        `numu-theme-submit-${Date.now()}.zip`,
      );
      await zipDirectory(options.dir, zipPath);

      // Step 1: upload the ZIP via the generic upload endpoint.
      console.log("Uploading source...");
      const uploadRes = await uploadFile<UploadResponse>(
        "/themes/upload",
        zipPath,
      );
      if (uploadRes.status >= 300) {
        console.error(
          `\nUpload failed (${uploadRes.status}): ${JSON.stringify(uploadRes.data)}`,
        );
        process.exit(1);
      }
      const sourceZipPath = uploadRes.data?.source_zip_path;
      if (!sourceZipPath) {
        console.error(
          "\nUpload response missing `source_zip_path`. Backend may be out of date.",
        );
        process.exit(1);
      }

      // Step 2: submit the version against the marketplace listing.
      console.log(`Submitting version ${version} to marketplace...`);
      const submitRes = await apiRequest<VersionResponse>(
        "POST",
        `/marketplace/developer/themes/${encodeURIComponent(options.themeId)}/versions`,
        {
          version_string: version,
          source_zip_path: sourceZipPath,
          release_notes: options.notes ?? null,
        },
      );

      if (submitRes.status === 200 || submitRes.status === 202) {
        console.log("\n✓ Theme submitted for review!");
        console.log(`  Version ID: ${submitRes.data.version_id}`);
        console.log(`  Status:     ${submitRes.data.status}`);
        console.log("\n  Poll status with:");
        console.log(
          `    numu-theme status --version ${submitRes.data.version_id}`,
        );
      } else {
        console.error(
          `\nSubmission failed (${submitRes.status}): ${JSON.stringify(submitRes.data)}`,
        );
        process.exit(1);
      }
    },
  );
