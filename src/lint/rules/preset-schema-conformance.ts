/**
 * Rule: preset-schema-conformance
 *
 * A preset's `settings` block must only use setting IDs declared in
 * the matching section schema. Catches the common bug where a theme
 * dev renames a setting in the schema but forgets the preset.
 *
 * For `type: "select"` settings, the value must be one of the
 * declared options. For `type: "range"`, must be within min/max.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

const rule: LintRule = {
  id: "preset-schema-conformance",
  description: "Preset settings only use schema-declared ids + valid values",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    const presets = (ctx.manifest.presets as Record<string, unknown>) || {};
    const templates =
      (presets.templates as Record<string, Record<string, unknown>>) || {};

    for (const [templateKey, template] of Object.entries(templates)) {
      const sections =
        (template?.sections as Record<
          string,
          { type?: string; settings?: Record<string, unknown> }
        >) || {};
      for (const [sectionKey, section] of Object.entries(sections)) {
        if (!section?.type) continue;
        const schema = ctx.sectionSchemas[section.type];
        if (!schema) continue; // schema-registry-sync handles this
        const allowed = collectSettingDefs(
          (schema.settings as unknown[]) || [],
        );
        const setSettings = section.settings || {};
        for (const [settingId, value] of Object.entries(setSettings)) {
          const def = allowed.get(settingId);
          if (!def) {
            issues.push({
              rule: rule.id,
              severity: "error",
              file: "theme.json",
              message:
                `Template '${templateKey}' section '${sectionKey}' sets ` +
                `'${settingId}' but section schema '${section.type}' doesn't declare it.`,
              suggestion: `Add the setting to schemas/sections/${section.type}.json or remove it from the preset.`,
            });
            continue;
          }
          const optionError = validateSettingValue(def, value);
          if (optionError) {
            issues.push({
              rule: rule.id,
              severity: "error",
              file: "theme.json",
              message:
                `Template '${templateKey}' section '${sectionKey}' setting ` +
                `'${settingId}': ${optionError}`,
            });
          }
        }
      }
    }
    return issues;
  },
};

function collectSettingDefs(
  defs: unknown[],
): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  for (const d of defs) {
    if (d && typeof d === "object" && (d as Record<string, unknown>).id) {
      out.set(
        (d as Record<string, unknown>).id as string,
        d as Record<string, unknown>,
      );
    }
  }
  return out;
}

function validateSettingValue(
  def: Record<string, unknown>,
  value: unknown,
): string | null {
  const type = def.type as string;
  if (type === "select" || type === "radio") {
    const options = (def.options as Array<Record<string, unknown>>) || [];
    const validValues = options.map((o) => o.value);
    if (validValues.length > 0 && !validValues.includes(value as string)) {
      return `value '${String(value)}' is not one of [${validValues.join(", ")}]`;
    }
  }
  if (type === "range" || type === "number") {
    if (typeof value === "number") {
      const min = def.min as number | undefined;
      const max = def.max as number | undefined;
      if (min !== undefined && value < min)
        return `value ${value} is below min (${min})`;
      if (max !== undefined && value > max)
        return `value ${value} is above max (${max})`;
    }
  }
  if (type === "checkbox" && typeof value !== "boolean") {
    return `expected boolean, got ${typeof value}`;
  }
  return null;
}

export default rule;
