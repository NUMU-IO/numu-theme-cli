import { Command } from "commander";
import * as path from "path";
import * as os from "os";
import { loadConfig } from "../utils/config";
import { validateTheme } from "../utils/validator";
import { zipDirectory } from "../utils/zipper";
import { uploadFile } from "../utils/api";

export const pushCommand = new Command("push")
  .description("Upload built theme to a specific store for testing")
  .option("-s, --store <store_id>", "Target store ID")
  .option("-d, --dir <directory>", "Theme directory", ".")
  .action(async (options: { store?: string; dir: string }) => {
    const config = loadConfig();
    const storeId = options.store || config.store_id;

    if (!storeId) { console.error("No store ID. Use --store or set NUMU_STORE_ID"); process.exit(1); }
    if (!config.token) { console.error("Not logged in. Run: numu-theme login"); process.exit(1); }

    console.log("Validating...");
    const result = validateTheme(options.dir);
    if (!result.valid) {
      result.errors.forEach(e => console.error(`  ✗ ${e}`));
      process.exit(1);
    }

    console.log("Packaging theme...");
    const zipPath = path.join(os.tmpdir(), `numu-theme-${Date.now()}.zip`);
    await zipDirectory(options.dir, zipPath);

    console.log(`Uploading to store ${storeId}...`);
    const res = await uploadFile(`/stores/${storeId}/themes/upload`, zipPath);

    if (res.status === 200 || res.status === 201) {
      console.log("\n✓ Theme pushed successfully. It will be built and deployed shortly.");
      if (res.data?.build_id) console.log(`  Build ID: ${res.data.build_id}`);
    } else {
      console.error(`\nPush failed: ${JSON.stringify(res.data)}`);
      process.exit(1);
    }
  });
