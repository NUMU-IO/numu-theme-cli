import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { runAllRules, type LintIssue } from "../lint/runner";

/**
 * `numu-theme lint` — static analysis specific to NUMU theme contracts.
 *
 * Catches mistakes BEFORE the theme is built / submitted, not at
 * runtime when a merchant sees a broken page. Complements
 * `numu-theme doctor` (deployment-readiness) and `numu-theme check`
 * (generic ESLint) with NUMU-contract-specific rules:
 *
 *   • Schema ↔ section registry sync
 *   • Section preset settings conform to the section's schema
 *   • Locale key parity (ar ↔ en.default)
 *   • Hard-coded text in JSX that should be t() calls
 *   • Color hex literals that should read color_scheme settings
 *   • <img> without alt (a11y)
 *   • Sections referencing missing components
 *   • Unused settings in settings_schema.json
 *
 * Output:
 *   ✓/⚠/✘ markers, file:line, fix-suggestion text.
 *   Exit code 0 on success or warnings-only; 1 on errors.
 *   `--strict` flag treats warnings as errors (CI use).
 *   `--json` emits machine-readable output for editor integrations.
 */

export const lintCommand = new Command("lint")
  .description("Lint a NUMU theme against the platform's contract + best practices")
  .option("-d, --dir <directory>", "Theme directory", ".")
  .option("--strict", "Treat warnings as errors (exit 1)")
  .option("--json", "Output JSON instead of human-readable")
  .option(
    "--rules <rules>",
    "Comma-separated list of rule IDs to run (default: all)",
  )
  .action(
    async (options: {
      dir: string;
      strict?: boolean;
      json?: boolean;
      rules?: string;
    }) => {
      const themeDir = path.resolve(process.cwd(), options.dir);
      if (!fs.existsSync(path.join(themeDir, "theme.json"))) {
        console.error(
          `No theme.json found in ${themeDir}. Run 'numu-theme lint' from a theme project root.`,
        );
        process.exit(1);
      }

      const enabledRules = options.rules
        ? new Set(options.rules.split(",").map((r) => r.trim()))
        : null;
      const issues = await runAllRules(themeDir, {
        enabledRules,
      });

      if (options.json) {
        console.log(JSON.stringify({ issues }, null, 2));
        const hasErrors = issues.some((i) => i.severity === "error");
        process.exit(hasErrors || (options.strict && issues.length > 0) ? 1 : 0);
        return;
      }

      // Human-readable output.
      if (issues.length === 0) {
        console.log("✓ No issues found.");
        process.exit(0);
        return;
      }

      const grouped = groupByFile(issues);
      for (const [file, fileIssues] of Object.entries(grouped)) {
        console.log(`\n${file}`);
        for (const issue of fileIssues) {
          const marker = issue.severity === "error" ? "✘" : "⚠";
          const loc = issue.line ? `:${issue.line}` : "";
          console.log(`  ${marker} ${issue.rule}${loc} — ${issue.message}`);
          if (issue.suggestion) {
            console.log(`     ↳ ${issue.suggestion}`);
          }
        }
      }

      const errorCount = issues.filter((i) => i.severity === "error").length;
      const warnCount = issues.filter((i) => i.severity === "warning").length;
      console.log(
        `\n${errorCount} error${errorCount === 1 ? "" : "s"}, ` +
          `${warnCount} warning${warnCount === 1 ? "" : "s"}.`,
      );
      const shouldFail = errorCount > 0 || (options.strict && warnCount > 0);
      process.exit(shouldFail ? 1 : 0);
    },
  );

function groupByFile(issues: LintIssue[]): Record<string, LintIssue[]> {
  const out: Record<string, LintIssue[]> = {};
  for (const issue of issues) {
    const key = issue.file || "(theme-wide)";
    if (!out[key]) out[key] = [];
    out[key].push(issue);
  }
  return out;
}
