import { Command } from "commander";
import * as path from "path";
import * as os from "os";
import { loadConfig } from "../utils/config";
import { validateTheme } from "../utils/validator";
import { zipDirectory } from "../utils/zipper";
import { uploadFile } from "../utils/api";

interface UploadResponse {
  build_id?: string;
  source_zip_path?: string;
  status?: string;
}

/**
 * Push the local theme to the user's developer account for testing.
 *
 * The backend `POST /themes/upload` endpoint is store-agnostic — uploads
 * are tied to the developer's account (read from the bearer token). The
 * dashboard shows builds under the developer's "My uploaded themes" view.
 */
export const pushCommand = new Command("push")
  .description("Upload built theme to your developer account for testing")
  .option("-d, --dir <directory>", "Theme directory", ".")
  .action(async (options: { dir: string }) => {
    const config = loadConfig();
    if (!config.token) {
      console.error("Not logged in. Run: numu-theme login");
      process.exit(1);
    }

    console.log("Validating...");
    const result = validateTheme(options.dir);
    if (!result.valid) {
      result.errors.forEach((e) => console.error(`  ✗ ${e}`));
      process.exit(1);
    }

    console.log("Packaging theme...");
    const zipPath = path.join(os.tmpdir(), `numu-theme-${Date.now()}.zip`);
    await zipDirectory(options.dir, zipPath);

    console.log("Uploading...");
    const res = await uploadFile<UploadResponse>("/themes/upload", zipPath);

    if (res.status === 200 || res.status === 201 || res.status === 202) {
      console.log("\n✓ Theme uploaded. Build queued.");
      if (res.data?.build_id) {
        console.log(`  Build ID: ${res.data.build_id}`);
        console.log("  Poll status with:");
        console.log(
          `    numu-theme status --build ${res.data.build_id}`,
        );
      }
    } else {
      console.error(`\nPush failed (${res.status}): ${JSON.stringify(res.data)}`);
      process.exit(1);
    }
  });
