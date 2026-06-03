import { Command } from "commander";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { validateTheme } from "../utils/validator";
import { runAllRules } from "../lint/runner";

export const buildCommand = new Command("build")
  .description("Build the theme for production")
  .option("-d, --dir <directory>", "Theme directory", ".")
  .option(
    "--strict",
    "Treat lint warnings as errors (Shopify-style a11y/quality gate)",
  )
  .option("--no-lint", "Skip the lint gate (not recommended)")
  .action(
    async (options: { dir: string; strict?: boolean; lint?: boolean }) => {
      console.log("Validating before build...");
      const result = validateTheme(options.dir);
      if (!result.valid) {
        console.error("Validation failed. Fix errors before building.");
        result.errors.forEach((e) => console.error(`  ✗ ${e}`));
        process.exit(1);
      }

      // a11y/contract lint gate (Phase 5.3). Error-severity issues always
      // block the build; `--strict` also blocks on warnings (the CI bar).
      // `--no-lint` opts out for emergencies.
      if (options.lint !== false) {
        const issues = await runAllRules(
          path.resolve(process.cwd(), options.dir),
          { enabledRules: null },
        );
        const errors = issues.filter((i) => i.severity === "error");
        const warnings = issues.filter((i) => i.severity === "warning");
        if (issues.length > 0) {
          console.log("\nLint:");
          for (const i of issues) {
            const marker = i.severity === "error" ? "✘" : "⚠";
            const loc = i.file
              ? ` ${i.file}${i.line ? ":" + i.line : ""}`
              : "";
            console.log(`  ${marker} ${i.rule}${loc} — ${i.message}`);
          }
        }
        const blocked =
          errors.length > 0 || (options.strict && warnings.length > 0);
        if (blocked) {
          console.error(
            `\nLint gate failed: ${errors.length} error(s), ${warnings.length} warning(s)` +
              `${options.strict ? " (--strict treats warnings as errors)" : ""}.`,
          );
          process.exit(1);
        }
        if (warnings.length > 0) {
          console.log(
            `\n⚠ ${warnings.length} lint warning(s) — run \`numu-theme lint\` for detail, or \`--strict\` to enforce.`,
          );
        }
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
          if (fs.statSync(filePath).isFile())
            totalSize += fs.statSync(filePath).size;
        }
        const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
        console.log(`\nBundle size: ${sizeMB} MB`);
        if (totalSize > 5 * 1024 * 1024) {
          console.warn(
            "⚠ Bundle exceeds 5MB limit — optimize before submitting to marketplace",
          );
        }
      }

      console.log("\n✓ Build complete");
    },
  );
