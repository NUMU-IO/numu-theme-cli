/**
 * Rule: physical-css-direction
 *
 * NUMU storefronts are Arabic-first, so every theme renders under
 * `dir="rtl"` at least as often as `dir="ltr"`. A physical property
 * (`margin-left`, `pl-4`, `text-right`, `left: 0`) is pinned to one
 * direction and silently mirrors wrong in the other: a back arrow points
 * the wrong way, a badge sits on the wrong corner, a label detaches from
 * its input. The logical equivalent (`margin-inline-start`, `ps-4`,
 * `text-start`, `inset-inline-start: 0`) follows the writing direction.
 *
 * Comments are blanked before scanning: a comment that explains "use
 * `text-start`, not `text-left`" is not a violation of itself.
 *
 * A warning, not an error: some content is LTR by design — prices,
 * phone numbers, tracking codes and chart axes stay LTR even in Arabic UI
 * — so a `text-left` on a number can be the correct answer. Lines that
 * already scope the utility with Tailwind's `rtl:` / `ltr:` variants are
 * deliberate and skipped.
 */

import { blankComments } from "../strip-comments";
import type { LintContext, LintIssue, LintRule } from "../runner";

/** Tailwind utilities, and the logical utility that replaces each one. */
const CLASS_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bml-(?=[\d[a-z])/, "ms-"],
  [/\bmr-(?=[\d[a-z])/, "me-"],
  [/\bpl-(?=[\d[a-z])/, "ps-"],
  [/\bpr-(?=[\d[a-z])/, "pe-"],
  [/\btext-left\b/, "text-start"],
  [/\btext-right\b/, "text-end"],
  [/\bborder-l(?:-|\b)/, "border-s"],
  [/\bborder-r(?:-|\b)/, "border-e"],
  [/\brounded-l(?:-|\b)/, "rounded-s"],
  [/\brounded-r(?:-|\b)/, "rounded-e"],
  [/\bleft-(?=[\d[a-z])/, "start-"],
  [/\bright-(?=[\d[a-z])/, "end-"],
];

/** Raw CSS declarations, and the logical property that replaces each one. */
const CSS_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bmargin-left\s*:/, "margin-inline-start"],
  [/\bmargin-right\s*:/, "margin-inline-end"],
  [/\bpadding-left\s*:/, "padding-inline-start"],
  [/\bpadding-right\s*:/, "padding-inline-end"],
  [/\bborder-left\b(?!-)/, "border-inline-start"],
  [/\bborder-right\b(?!-)/, "border-inline-end"],
  [/\btext-align\s*:\s*left\b/, "text-align: start"],
  [/\btext-align\s*:\s*right\b/, "text-align: end"],
  [/\bfloat\s*:\s*(left|right)\b/, "float: inline-start / inline-end"],
];

/** A direction-scoped line is deliberate: `ltr:ml-2 rtl:mr-2`, `[dir=rtl]`. */
function isDirectionScoped(line: string): boolean {
  return /\b(rtl|ltr):|\[dir\s*=|:dir\(/.test(line);
}

const rule: LintRule = {
  id: "physical-css-direction",
  description:
    "Use logical CSS (margin-inline-start, ps-4, text-start) so the theme mirrors under RTL",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];

    const scan = (
      file: string | undefined,
      source: string,
      replacements: Array<[RegExp, string]>,
    ) => {
      const lines = blankComments(source).split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isDirectionScoped(line)) continue;
        for (const [pattern, logical] of replacements) {
          const match = line.match(pattern);
          if (!match) continue;
          issues.push({
            rule: rule.id,
            severity: "warning",
            file,
            line: i + 1,
            message: `Physical direction in "${match[0].trim()}" — it does not mirror under RTL.`,
            suggestion: `Use ${logical} instead.`,
          });
        }
      }
    };

    for (const [file, source] of Object.entries(ctx.sources)) {
      scan(file, source, CLASS_REPLACEMENTS);
    }
    if (ctx.styles) scan("styles.css", ctx.styles, CSS_REPLACEMENTS);

    return issues;
  },
};

export default rule;
