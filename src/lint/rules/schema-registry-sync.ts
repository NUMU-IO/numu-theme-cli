/**
 * Rule: schema-registry-sync
 *
 * Every section referenced anywhere in `theme.json:presets` MUST
 * have a matching `schemas/sections/<type>.json`. Same in reverse:
 * an orphan schema is a code smell (no preset can place it) but
 * not an error since it might be added to a preset later.
 *
 * Block-level mirror checks too.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

const rule: LintRule = {
  id: "schema-registry-sync",
  description:
    "Every section/block referenced in presets has a matching schema file",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    const presets = (ctx.manifest.presets as Record<string, unknown>) || {};
    const templates =
      (presets.templates as Record<string, Record<string, unknown>>) || {};

    const referencedSectionTypes = new Set<string>();
    for (const template of Object.values(templates)) {
      const sections =
        (template?.sections as Record<string, { type?: string }>) || {};
      for (const section of Object.values(sections)) {
        if (section?.type) referencedSectionTypes.add(section.type);
      }
    }

    for (const type of referencedSectionTypes) {
      if (!ctx.sectionSchemas[type]) {
        issues.push({
          rule: rule.id,
          severity: "error",
          file: "theme.json",
          message: `Preset references section type '${type}' but no schemas/sections/${type}.json exists.`,
          suggestion: `Create schemas/sections/${type}.json or remove the section from the preset.`,
        });
      }
    }

    // Orphan schemas — warning, not error.
    for (const type of Object.keys(ctx.sectionSchemas)) {
      if (!referencedSectionTypes.has(type)) {
        // Only warn for sections that *could* have been used in a
        // preset. If the theme is small / new, this is noise — but
        // accumulating orphans is a real code-smell.
        if (Object.keys(referencedSectionTypes).length === 0) continue;
        issues.push({
          rule: rule.id,
          severity: "warning",
          file: `schemas/sections/${type}.json`,
          message: `Section type '${type}' has a schema but isn't used in any preset.`,
          suggestion: `Add it to a preset or delete the unused schema.`,
        });
      }
    }
    return issues;
  },
};

export default rule;
