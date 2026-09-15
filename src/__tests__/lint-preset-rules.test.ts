/**
 * `schema-registry-sync` + `preset-schema-conformance` against real preset
 * shapes: array `sections`, and chrome placed in `presets.section_groups`.
 * Both rules used to read only `presets.templates`, and the orphan-schema
 * warning was gated on `Object.keys(aSet)` — always [] — so it never fired.
 */

import { describe, it, expect } from "vitest";
import schemaRegistrySync from "../lint/rules/schema-registry-sync";
import presetSchemaConformance from "../lint/rules/preset-schema-conformance";
import type { LintContext, LintIssue } from "../lint/runner";

function ctx(partial: Partial<LintContext>): LintContext {
  return {
    themeDir: ".",
    manifest: {},
    settingsSchema: [],
    sectionSchemas: {},
    blockSchemas: {},
    locales: {},
    sources: {},
    styles: "",
    ...partial,
  };
}

const manifest = {
  presets: {
    templates: { home: { sections: [{ type: "hero" }] } },
    section_groups: {
      header: { sections: [{ type: "header", settings: { bogus: 1 } }] },
      // map-shaped sections (id → instance) are still accepted
      footer: { sections: { f1: { type: "footer" } } },
    },
  },
};

const schema = (type: string) => ({ type, name: type, settings: [] });

describe("schema-registry-sync", () => {
  it("errors on section_groups types (array or map) that have no schema", () => {
    const issues = schemaRegistrySync.check(
      ctx({ manifest, sectionSchemas: { hero: schema("hero") } }),
    ) as LintIssue[];
    const errors = issues.filter((i) => i.severity === "error").map((i) => i.message);
    expect(errors).toHaveLength(2);
    expect(errors.some((m) => m.includes("'header'"))).toBe(true);
    expect(errors.some((m) => m.includes("'footer'"))).toBe(true);
  });

  it("warns on an orphan schema, and counts section_groups as used", () => {
    const issues = schemaRegistrySync.check(
      ctx({
        manifest,
        sectionSchemas: {
          hero: schema("hero"),
          header: schema("header"),
          footer: schema("footer"),
          unused: schema("unused"),
        },
      }),
    ) as LintIssue[];
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      severity: "warning",
      file: "schemas/sections/unused.json",
    });
  });
});

describe("preset-schema-conformance", () => {
  it("checks settings of sections placed in section_groups", () => {
    const issues = presetSchemaConformance.check(
      ctx({ manifest, sectionSchemas: { header: schema("header") } }),
    ) as LintIssue[];
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("Section group 'header' section '0' sets 'bogus'");
  });
});
