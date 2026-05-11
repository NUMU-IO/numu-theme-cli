/**
 * Rule: unused-settings
 *
 * Every setting declared in settings_schema.json should be read by
 * at least one section, block, or main.tsx. Unused settings are
 * either dead code or evidence of a rename that wasn't propagated.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

const rule: LintRule = {
  id: "unused-settings",
  description: "Every settings_schema entry is read by some component",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    const schema = ctx.settingsSchema || [];

    // Collect declared setting IDs.
    const declared: string[] = [];
    for (const def of schema) {
      if (def && typeof def === "object") {
        const id = (def as Record<string, unknown>).id;
        if (typeof id === "string") declared.push(id);
      }
    }
    if (declared.length === 0) return issues;

    // Search every source file + section/block schema for references.
    // Heuristic: occurrences of the setting id as a quoted string,
    // OR as a property access in a settings/theme object.
    const haystack = [
      ...Object.values(ctx.sources),
      ...Object.values(ctx.sectionSchemas).map((s) => JSON.stringify(s)),
      ...Object.values(ctx.blockSchemas).map((s) => JSON.stringify(s)),
    ].join("\n");

    for (const id of declared) {
      // Look for quoted "id" or .id or ['id'] patterns. False
      // positives from "id" being a substring of another word
      // are avoided by requiring quote / dot / bracket boundaries.
      const patterns = [
        new RegExp(`["']${escapeRe(id)}["']`),
        new RegExp(`\\.${escapeRe(id)}\\b`),
      ];
      const used = patterns.some((p) => p.test(haystack));
      if (!used) {
        issues.push({
          rule: rule.id,
          severity: "warning",
          file: "settings_schema.json",
          message: `Setting '${id}' is declared but never read.`,
          suggestion: `Remove from settings_schema.json or wire it up in a section.`,
        });
      }
    }
    return issues;
  },
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default rule;
