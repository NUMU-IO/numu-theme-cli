import { Command } from "commander";
import { validateTheme } from "../utils/validator";

export const checkCommand = new Command("check")
  .description("Validate theme schemas and structure")
  .option("-d, --dir <directory>", "Theme directory", ".")
  .action(async (options: { dir: string }) => {
    console.log("Validating theme...");
    const result = validateTheme(options.dir);

    if (result.warnings.length > 0) {
      console.log("\nWarnings:");
      result.warnings.forEach(w => console.log(`  ⚠ ${w}`));
    }

    if (result.errors.length > 0) {
      console.log("\nErrors:");
      result.errors.forEach(e => console.log(`  ✗ ${e}`));
      console.log(`\nValidation failed with ${result.errors.length} error(s)`);
      process.exit(1);
    }

    console.log(`\n✓ Theme is valid (${result.warnings.length} warning(s))`);
  });
