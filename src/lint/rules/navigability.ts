/**
 * Rule: navigability
 *
 * A theme must ship its own storefront chrome: at least one header
 * section and one footer section. Themes without them render the
 * host's generic `ByotChromeFallback` strip instead of a real
 * navigation — the "unnavigable theme" bug class (guarantee G2).
 *
 * Detection mirrors the host's `byotProvidesOwnChrome()`
 * (numu-storefront/src/lib/resolve-theme.ts): a section counts as
 * chrome when its schema declares `tag: "header" | "footer"`, or —
 * legacy name-match, same as the host regex — when its section type
 * name looks like header/navbar/topbar/footer. Schemas live in
 * `schemas/sections/*.json`; settings-array divider fields with
 * `type: "header"` are unrelated and never consulted.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

/** Same shape the host matches on (resolve-theme.ts CHROME_TYPE_RE), split per kind. */
const HEADER_NAME_RE = /(?:^|[-_])(?:header|navbar|topbar)(?:$|[-_])|header$/i;
const FOOTER_NAME_RE = /(?:^|[-_])footer(?:$|[-_])|footer$/i;

type Kind = "header" | "footer";

function chromeTypes(
  sectionSchemas: Record<string, Record<string, unknown>>,
  kind: Kind,
): { tagged: string[]; nameOnly: string[] } {
  const nameRe = kind === "header" ? HEADER_NAME_RE : FOOTER_NAME_RE;
  const tagged: string[] = [];
  const nameOnly: string[] = [];
  for (const [type, schema] of Object.entries(sectionSchemas)) {
    const tag = typeof schema.tag === "string" ? schema.tag.toLowerCase() : "";
    if (tag === kind) tagged.push(type);
    else if (!tag && nameRe.test(type)) nameOnly.push(type);
  }
  return { tagged, nameOnly };
}

const rule: LintRule = {
  id: "navigability",
  description:
    "Theme ships real chrome: a header and a footer section (G2 — no fallback strip)",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];

    const found: Record<Kind, string[]> = { header: [], footer: [] };
    for (const kind of ["header", "footer"] as Kind[]) {
      const { tagged, nameOnly } = chromeTypes(ctx.sectionSchemas, kind);
      found[kind] = [...tagged, ...nameOnly];

      if (tagged.length === 0 && nameOnly.length === 0) {
        issues.push({
          rule: rule.id,
          severity: "error",
          message:
            `Theme declares no ${kind} section — shoppers get the host's generic ` +
            `fallback strip instead of the theme's own ${kind}/navigation.`,
          suggestion:
            `Add a ${kind} section component and a schemas/sections/<type>.json ` +
            `with "tag": "${kind}" (and "limit": 1), register it in the section ` +
            `registry, and include it in every preset template.`,
        });
        continue;
      }

      // Chrome exists by name only — works via the host's legacy regex, but
      // the editor's section-group machinery keys off the tag. Nudge, don't block.
      if (tagged.length === 0) {
        issues.push({
          rule: rule.id,
          severity: "warning",
          file: `schemas/sections/${nameOnly[0]}.json`,
          message:
            `Section '${nameOnly[0]}' looks like a ${kind} but its schema has no ` +
            `"tag": "${kind}" — the customizer's header/footer group handling keys off the tag.`,
          suggestion: `Add "tag": "${kind}" (and "limit": 1) to the schema.`,
        });
      }
    }

    // Placement: chrome must actually be PLACED somewhere. Two legitimate
    // patterns exist — global `presets.section_groups` (applies to every
    // template) or inline per-template bracketing. Only warn when NEITHER
    // covers a template. Warning-level: install-time customization can also
    // supply chrome.
    if (found.header.length > 0 && found.footer.length > 0) {
      const presets = (ctx.manifest.presets as Record<string, unknown>) || {};
      const templates =
        (presets.templates as Record<string, Record<string, unknown>>) || {};
      const groups =
        (presets.section_groups as Record<string, Record<string, unknown>>) ||
        {};
      const headerSet = new Set(found.header.map((t) => t.toLowerCase()));
      const footerSet = new Set(found.footer.map((t) => t.toLowerCase()));

      const sectionTypes = (container: unknown): string[] => {
        const sections = (container as Record<string, unknown>)?.sections;
        const types: string[] = [];
        const list = Array.isArray(sections)
          ? sections
          : sections && typeof sections === "object"
            ? Object.values(sections)
            : [];
        for (const s of list) {
          const t = (s as Record<string, unknown>)?.type;
          if (typeof t === "string") types.push(t.toLowerCase());
        }
        return types;
      };

      const groupTypes = Object.values(groups).flatMap(sectionTypes);
      const groupHasHeader = groupTypes.some(
        (t) => headerSet.has(t) || t === "header",
      );
      const groupHasFooter = groupTypes.some(
        (t) => footerSet.has(t) || t === "footer",
      );

      for (const [templateKey, template] of Object.entries(templates)) {
        const types = sectionTypes(template);
        if (types.length === 0) continue;
        const hasHeader =
          groupHasHeader ||
          types.some((t) => headerSet.has(t) || t === "header");
        const hasFooter =
          groupHasFooter ||
          types.some((t) => footerSet.has(t) || t === "footer");
        if (!hasHeader || !hasFooter) {
          const missing = [
            ...(hasHeader ? [] : ["header"]),
            ...(hasFooter ? [] : ["footer"]),
          ].join(" + ");
          issues.push({
            rule: rule.id,
            severity: "warning",
            file: "theme.json",
            message: `Preset template '${templateKey}' places no ${missing} section.`,
            suggestion:
              `Bracket the template's sections with the theme's header first and footer last, ` +
              `or place them once in presets.section_groups.`,
          });
        }
      }
    }

    return issues;
  },
};

export default rule;
