/**
 * Rule: img-missing-alt
 *
 * Every `<img>` tag must have an `alt` attribute (even if empty for
 * decorative images — WCAG considers empty `alt=""` correct for
 * pure decoration; missing alt entirely is the violation).
 *
 * SDK's <Image> component takes alt as a prop and warns at runtime;
 * this rule catches raw `<img>` tags that bypass the SDK.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

const rule: LintRule = {
  id: "img-missing-alt",
  description: "Every <img> tag has an alt attribute",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    for (const [file, source] of Object.entries(ctx.sources)) {
      const lines = source.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match opening <img ...> tags. JSX puts `alt={...}` /
        // `alt="..."` inside the tag's attribute list.
        const imgMatches = line.match(/<img\b[^>]*>/g);
        if (!imgMatches) continue;
        for (const match of imgMatches) {
          if (!/\balt\s*=/.test(match)) {
            issues.push({
              rule: rule.id,
              severity: "warning",
              file,
              line: i + 1,
              message: `<img> tag missing alt attribute.`,
              suggestion: `Add alt="..." (or alt="" for purely decorative images), or use <Image> from @numu/theme-sdk.`,
            });
          }
        }
      }
    }
    return issues;
  },
};

export default rule;
