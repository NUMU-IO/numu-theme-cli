/**
 * Rule: locale-parity
 *
 * Every locale file should declare the same key set. A merchant
 * switching the storefront from English to Arabic shouldn't see
 * keys silently fall back to English (or worse, raw key names) just
 * because the translator forgot a line.
 *
 * The default locale (typically `en.default.json`) is the source of
 * truth; every other locale's keys must equal that set.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

const rule: LintRule = {
  id: "locale-parity",
  description: "Non-default locale files have the same key set as the default",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    const locales = ctx.locales;
    if (Object.keys(locales).length < 2) return issues; // single-locale themes are fine

    // Pick the default locale. Convention: filename ends in
    // `.default.json` → captured by readLocales as the bare code,
    // so we use `en` as the default fallback if explicit isn't set.
    // The runner stripped the `.default` suffix already.
    const defaultCode = "en";
    const defaultKeys = collectKeys(locales[defaultCode] || {});
    if (defaultKeys.size === 0) return issues;

    for (const [code, dict] of Object.entries(locales)) {
      if (code === defaultCode) continue;
      const keys = collectKeys(dict);
      const missing: string[] = [];
      const extra: string[] = [];
      for (const k of defaultKeys) if (!keys.has(k)) missing.push(k);
      for (const k of keys) if (!defaultKeys.has(k)) extra.push(k);

      if (missing.length) {
        issues.push({
          rule: rule.id,
          severity: "error",
          file: `locales/${code}.json`,
          message: `Missing ${missing.length} key${missing.length === 1 ? "" : "s"} present in the default locale.`,
          suggestion:
            `First missing keys: ` +
            missing.slice(0, 5).join(", ") +
            (missing.length > 5 ? ` (+${missing.length - 5} more)` : ""),
        });
      }
      if (extra.length) {
        issues.push({
          rule: rule.id,
          severity: "warning",
          file: `locales/${code}.json`,
          message: `Has ${extra.length} extra key${extra.length === 1 ? "" : "s"} not in the default locale (will fall back when the default is rendered).`,
          suggestion:
            `Extra keys: ` +
            extra.slice(0, 5).join(", ") +
            (extra.length > 5 ? ` (+${extra.length - 5} more)` : ""),
        });
      }
    }
    return issues;
  },
};

function collectKeys(
  dict: Record<string, unknown>,
  prefix = "",
): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(dict)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const nested of collectKeys(v as Record<string, unknown>, full)) {
        out.add(nested);
      }
    } else {
      out.add(full);
    }
  }
  return out;
}

export default rule;
