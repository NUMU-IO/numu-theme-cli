/**
 * Rule: forbidden-script-tag
 *
 * Inline `<script>` tags in section components are blocked by the
 * BYOT contract — the marketplace AST scanner refuses bundles that
 * contain them, and the storefront's CSP would block them at
 * runtime anyway.
 *
 * Catches it BEFORE submission so devs don't waste a build cycle.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

const rule: LintRule = {
  id: "forbidden-script-tag",
  description:
    "Section components can't contain <script> tags (CSP + AST scanner forbid)",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    for (const [file, source] of Object.entries(ctx.sources)) {
      const lines = source.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/<script[\s>]/i.test(line)) {
          issues.push({
            rule: rule.id,
            severity: "error",
            file,
            line: i + 1,
            message: `<script> tag in theme source — marketplace AST scanner will reject.`,
            suggestion: `Use a useEffect hook to load behavior, or move analytics to useAnalytics().`,
          });
        }
      }
    }
    return issues;
  },
};

export default rule;
