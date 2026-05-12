/**
 * Rule: use-app-no-availability-check
 *
 * Themes calling `useApp("slug")` without branching on the returned
 * `.available` flag will render a broken UI on stores that haven't
 * installed the app. Phase 6 contract requires graceful degradation.
 *
 * Heuristic: if a file contains `useApp(` it should also reference
 * `.available` within the same file. Won't catch every case
 * (destructured `const { available } = useApp(...)` is a counter-
 * example we want to PASS); we look for both raw and destructured
 * patterns.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

const rule: LintRule = {
  id: "use-app-no-availability-check",
  description: "useApp() calls should branch on .available for graceful fallback",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    for (const [file, source] of Object.entries(ctx.sources)) {
      if (!/\buseApp\s*\(/.test(source)) continue;
      const hasAvailableCheck =
        /\.available\b/.test(source) ||
        /\{\s*[^}]*\bavailable\b/.test(source);
      if (!hasAvailableCheck) {
        // Find the useApp call's line for the suggestion.
        const lines = source.split("\n");
        let lineNum = 0;
        for (let i = 0; i < lines.length; i++) {
          if (/\buseApp\s*\(/.test(lines[i])) {
            lineNum = i + 1;
            break;
          }
        }
        issues.push({
          rule: rule.id,
          severity: "warning",
          file,
          line: lineNum,
          message: `useApp() result is used without checking .available — UI breaks on stores without the app installed.`,
          suggestion: `if (!app.available) return <Fallback />; before rendering app.data.`,
        });
      }
    }
    return issues;
  },
};

export default rule;
