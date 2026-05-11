/**
 * Rule: inline-color-literal
 *
 * Color hex literals in JSX style props bypass the merchant's
 * `color_scheme` / theme-settings color customization. A theme that
 * hardcodes `#FF0000` for a "Sale" badge can't be re-themed without
 * a code change.
 *
 * Doesn't fire on Tailwind class names (those are intentional design
 * tokens), only on literal hex/rgb strings inside `style={{...}}`.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

const rule: LintRule = {
  id: "inline-color-literal",
  description: "Don't hardcode hex colors in style props — use theme settings",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    for (const [file, source] of Object.entries(ctx.sources)) {
      const lines = source.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Look for hex inside a style= block.
        if (!/style\s*=\s*\{/.test(line) && !/style=\{\{/.test(line)) continue;
        const hexMatch = line.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g);
        if (hexMatch) {
          issues.push({
            rule: rule.id,
            severity: "warning",
            file,
            line: i + 1,
            message: `Hardcoded color (${hexMatch.join(", ")}) in style prop.`,
            suggestion: `Read from useThemeSettings() or a color_scheme setting so merchants can rebrand.`,
          });
        }
        const rgbMatch = line.match(/rgba?\s*\(/g);
        if (rgbMatch) {
          issues.push({
            rule: rule.id,
            severity: "warning",
            file,
            line: i + 1,
            message: `Hardcoded rgb()/rgba() in style prop.`,
            suggestion: `Read from useThemeSettings() or a color_scheme setting.`,
          });
        }
      }
    }
    return issues;
  },
};

export default rule;
