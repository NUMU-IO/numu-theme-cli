import { Command } from "commander";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { validateTheme } from "../utils/validator";

export const buildCommand = new Command("build")
  .description("Build the theme for production")
  .option("-d, --dir <directory>", "Theme directory", ".")
  .action(async (options: { dir: string }) => {
    console.log("Validating before build...");
    const result = validateTheme(options.dir);
    if (!result.valid) {
      console.error("Validation failed. Fix errors before building.");
      result.errors.forEach(e => console.error(`  ✗ ${e}`));
      process.exit(1);
    }

    console.log("Building theme...");
    try {
      execSync("npx vite build", { cwd: options.dir, stdio: "inherit" });
    } catch {
      console.error("Build failed");
      process.exit(1);
    }

    // Check bundle size
    const distDir = path.join(options.dir, "dist");
    if (fs.existsSync(distDir)) {
      let totalSize = 0;
      const files = fs.readdirSync(distDir, { recursive: true }) as string[];
      for (const file of files) {
        const filePath = path.join(distDir, file);
        if (fs.statSync(filePath).isFile()) totalSize += fs.statSync(filePath).size;
      }
      const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
      console.log(`\nBundle size: ${sizeMB} MB`);
      if (totalSize > 5 * 1024 * 1024) {
        console.warn("⚠ Bundle exceeds 5MB limit — optimize before submitting to marketplace");
      }
    }

    console.log("\n✓ Build complete");
  });
