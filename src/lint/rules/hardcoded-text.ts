/**
 * Rule: hardcoded-text
 *
 * String literals inside JSX text content that look like UI copy
 * (3+ words, contains a letter) should probably be `t()` calls
 * instead. Catches the most common i18n drift — devs hardcoding
 * English while pretending the theme is i18n-ready.
 *
 * Heuristic-based — won't catch every case + may false-positive on
 * legitimate constants. Warning severity only.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

const rule: LintRule = {
  id: "hardcoded-text",
  description:
    "JSX text content with 3+ words should use t() for translatability",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    for (const [file, source] of Object.entries(ctx.sources)) {
      // Skip files clearly not meant for theme rendering.
      if (file.includes("/dev-entry") || file.endsWith(".test.tsx")) continue;
      const lines = source.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match JSX text: > word word word word< pattern.
        // Excludes attributes (handled by quoted-strings later) and
        // expressions in {}.
        const m = line.match(/>([^<>{}\n]{8,})</g);
        if (!m) continue;
        for (const block of m) {
          const text = block.slice(1, -1).trim();
          if (!isUiCopy(text)) continue;
          issues.push({
            rule: rule.id,
            severity: "warning",
            file,
            line: i + 1,
            message: `Hardcoded text "${truncate(text, 40)}" — won't translate.`,
            suggestion: `Replace with {t("section.key")} and add the key to locales/*.json.`,
          });
        }
      }
    }
    return issues;
  },
};

function isUiCopy(text: string): boolean {
  // Must have at least one letter and 3+ words.
  if (!/[a-zA-Z]/.test(text)) return false;
  const words = text.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (words.length < 3) return false;
  // Skip pure URL / class name / variable patterns.
  if (/^https?:\/\//.test(text)) return false;
  if (/^[a-z][\w-]*$/.test(text)) return false;
  return true;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default rule;
