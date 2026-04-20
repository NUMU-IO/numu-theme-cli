import { Command } from "commander";
import * as path from "path";
import * as os from "os";
import { loadConfig } from "../utils/config";
import { validateTheme } from "../utils/validator";
import { zipDirectory } from "../utils/zipper";
import { uploadFile } from "../utils/api";

export const submitCommand = new Command("submit")
  .description("Submit theme to the NUMU Marketplace for review")
  .option("-d, --dir <directory>", "Theme directory", ".")
  .action(async (options: { dir: string }) => {
    const config = loadConfig();
    if (!config.token) { console.error("Not logged in. Run: numu-theme login"); process.exit(1); }

    console.log("Running full validation...");
    const result = validateTheme(options.dir);
    if (!result.valid) {
      console.error("Theme must pass all validations before marketplace submission.");
      result.errors.forEach(e => console.error(`  ✗ ${e}`));
      process.exit(1);
    }

    if (result.warnings.length > 0) {
      console.log("\nWarnings (consider fixing before submission):");
      result.warnings.forEach(w => console.log(`  ⚠ ${w}`));
    }

    console.log("\nPackaging full source for review...");
    const zipPath = path.join(os.tmpdir(), `numu-theme-submit-${Date.now()}.zip`);
    await zipDirectory(options.dir, zipPath);

    console.log("Submitting to NUMU Marketplace...");
    const res = await uploadFile("/marketplace/developer/themes/submit", zipPath);

    if (res.status === 200 || res.status === 201) {
      console.log("\n✓ Theme submitted for review!");
      console.log("  You will receive a notification when the review is complete.");
      if (res.data?.version_id) console.log(`  Version ID: ${res.data.version_id}`);
    } else {
      console.error(`\nSubmission failed: ${JSON.stringify(res.data)}`);
      process.exit(1);
    }
  });
