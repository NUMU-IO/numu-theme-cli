/**
 * Unit tests for the `no-kit-image-transform` lint rule.
 *
 * The rule guards a silent, fleet-wide visual regression: `@numueg/theme-kit`
 * and `@numueg/theme-sdk` both export `applyImageTransform`, and the kit's
 * copy returns `{ objectFit: fit }` for an image with NO transform. An inline
 * style beats a className, so importing the kit's version re-crops every
 * untransformed merchant image — including class-free header logos — with
 * nothing erroring.
 *
 * Both halves matter equally and are asserted here:
 *   1. it FIRES on a theme-kit image-transform import, and
 *   2. it does NOT fire on the SDK import — including in a file that also
 *      imports other, legitimate symbols from theme-kit. A rule that flagged
 *      the correct usage would be turned off, and then it guards nothing.
 */

import { describe, expect, it } from "vitest";
import rule from "../lint/rules/no-kit-image-transform";
import type { LintContext } from "../lint/runner";

function ctx(sources: Record<string, string>): LintContext {
  return {
    themeDir: ".",
    manifest: {},
    settingsSchema: [],
    sectionSchemas: {},
    blockSchemas: {},
    locales: {},
    sources,
    styles: "",
  };
}

describe("no-kit-image-transform", () => {
  it("flags applyImageTransform imported from @numueg/theme-kit", () => {
    const issues = rule.check(
      ctx({
        "src/sections/hero.tsx":
          'import { applyImageTransform } from "@numueg/theme-kit";\n',
      }),
    ) as any[];
    expect(issues.length).toBe(1);
    expect(issues[0].rule).toBe("no-kit-image-transform");
    expect(issues[0].severity).toBe("error");
    expect(issues[0].file).toBe("src/sections/hero.tsx");
    expect(issues[0].suggestion).toContain("@numueg/theme-sdk");
  });

  it("flags the type-only exports too (asImageTransform, ImageTransform)", () => {
    const issues = rule.check(
      ctx({
        "src/a.ts": 'import type { ImageTransform } from "@numueg/theme-kit";\n',
        "src/b.ts": 'import { asImageTransform } from "@numueg/theme-kit";\n',
      }),
    ) as any[];
    expect(issues.length).toBe(2);
  });

  it("stays quiet on the SDK import — the correct usage", () => {
    const issues = rule.check(
      ctx({
        "src/sections/hero.tsx":
          'import { applyImageTransform, asImageTransform } from "@numueg/theme-sdk";\n',
      }),
    ) as any[];
    expect(issues).toEqual([]);
  });

  it("no false positive when the same file imports OTHER symbols from theme-kit", () => {
    const issues = rule.check(
      ctx({
        "src/sections/hero.tsx":
          'import { asRecord, pickItems } from "@numueg/theme-kit";\n' +
          'import { applyImageTransform } from "@numueg/theme-sdk";\n',
      }),
    ) as any[];
    expect(issues).toEqual([]);
  });

  it("sees through an aliased import", () => {
    const issues = rule.check(
      ctx({
        "src/a.ts":
          'import { applyImageTransform as applyT } from "@numueg/theme-kit";\n',
      }),
    ) as any[];
    expect(issues.length).toBe(1);
  });

  it("no sources → no issues", () => {
    expect(rule.check(ctx({})) as any[]).toEqual([]);
  });
});
