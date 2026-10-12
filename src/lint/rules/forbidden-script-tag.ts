/**
 * Rule: forbidden-script-tag
 *
 * Inline `<script>` tags in section components are blocked by the
 * BYOT contract: code belongs in hooks (useEffect, useAnalytics), and
 * the storefront's CSP would block an inline script at runtime anyway.
 *
 * One exception: `<script type="application/ld+json">`, structured data
 * for search engines (a FAQ's FAQPage, a product's Product). The browser
 * never executes a data block, so CSP does not apply to it, and the
 * marketplace scanner (NUMU-api theme_upload_tasks AST scan) checks
 * eval, Function, document.cookie/write and innerHTML, not data blocks.
 * The type may sit on the next lines of a multi-line tag.
 *
 * Catches it BEFORE submission so devs don't waste a build cycle.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

const JSON_LD = /<script[^>]*\btype=\{?["'`]application\/ld\+json["'`]/i;

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
        const tag = lines.slice(i, i + 3).join(" ");
        if (/<script[\s>]/i.test(line) && !JSON_LD.test(tag)) {
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
