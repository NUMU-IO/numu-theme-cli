/**
 * Unit tests for the `navigability` rule (guarantee G2) and the comment
 * blanking that keeps `hardcoded-text` / `img-missing-alt` honest.
 *
 * The navigability rule is a PUBLISH GATE: a theme that ships no header or
 * footer leaves shoppers on the host's generic fallback strip with no
 * navigation. These tests pin both directions — it must fire on a
 * chrome-less theme and stay silent on a well-formed one — because a gate
 * that quietly stops firing is worse than no gate.
 */

import { describe, it, expect } from "vitest";
import navigability from "../lint/rules/navigability";
import hardcodedText from "../lint/rules/hardcoded-text";
import imgMissingAlt from "../lint/rules/img-missing-alt";
import { blankComments } from "../lint/strip-comments";
import type { LintContext } from "../lint/runner";

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

const headerSchema = { type: "x-header", tag: "header", limit: 1, name: "Header" };
const footerSchema = { type: "x-footer", tag: "footer", limit: 1, name: "Footer" };

/** Chrome placed once via preset section_groups — covers every template. */
const groupPresets = {
  presets: {
    section_groups: {
      header: { sections: [{ type: "x-header" }] },
      footer: { sections: [{ type: "x-footer" }] },
    },
    templates: {
      home: { sections: [{ type: "x-hero" }] },
    },
  },
};

describe("navigability", () => {
  it("errors once per missing chrome kind when a theme ships none", () => {
    const issues = navigability.check(
      ctx({ sectionSchemas: { "x-hero": { type: "x-hero", name: "Hero" } } }),
    ) as ReturnType<typeof navigability.check> & Array<{ severity: string }>;
    const errors = (issues as Array<{ severity: string; message: string }>).filter(
      (i) => i.severity === "error",
    );
    expect(errors).toHaveLength(2);
    expect(errors.some((e) => e.message.includes("header"))).toBe(true);
    expect(errors.some((e) => e.message.includes("footer"))).toBe(true);
  });

  it("is silent for a theme with tagged chrome placed in section_groups", () => {
    const issues = navigability.check(
      ctx({
        sectionSchemas: { "x-header": headerSchema, "x-footer": footerSchema },
        manifest: groupPresets,
      }),
    ) as Array<unknown>;
    expect(issues).toHaveLength(0);
  });

  it("accepts per-template bracketing instead of section_groups", () => {
    const issues = navigability.check(
      ctx({
        sectionSchemas: { "x-header": headerSchema, "x-footer": footerSchema },
        manifest: {
          presets: {
            templates: {
              home: {
                sections: [
                  { type: "x-header" },
                  { type: "x-hero" },
                  { type: "x-footer" },
                ],
              },
            },
          },
        },
      }),
    ) as Array<unknown>;
    expect(issues).toHaveLength(0);
  });

  it("warns (not errors) when chrome is name-matched but untagged", () => {
    const issues = navigability.check(
      ctx({
        sectionSchemas: {
          "x-header": { type: "x-header", name: "Header" },
          "x-footer": { type: "x-footer", name: "Footer" },
        },
        manifest: groupPresets,
      }),
    ) as Array<{ severity: string }>;
    expect(issues.every((i) => i.severity === "warning")).toBe(true);
    expect(issues).toHaveLength(2);
  });

  it("does NOT mistake a settings-schema divider field for chrome", () => {
    // Settings arrays use `{ "type": "header" }` as a visual divider. That is
    // a different thing entirely from a SECTION tagged as chrome; treating it
    // as chrome would silently disarm the gate.
    const issues = navigability.check(
      ctx({
        sectionSchemas: {
          "x-hero": {
            type: "x-hero",
            name: "Hero",
            settings: [{ type: "header", content: "Layout" }],
          },
        },
      }),
    ) as Array<{ severity: string }>;
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(2);
  });

  it("flags a template that places neither header nor footer", () => {
    const issues = navigability.check(
      ctx({
        sectionSchemas: { "x-header": headerSchema, "x-footer": footerSchema },
        manifest: {
          presets: {
            templates: { orphan: { sections: [{ type: "x-hero" }] } },
          },
        },
      }),
    ) as Array<{ severity: string; message: string }>;
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].message).toContain("orphan");
  });
});

describe("blankComments", () => {
  it("preserves length and line count exactly", () => {
    const src = `const a = 1; // trailing\n/* block\n   lines */\nconst b = 2;\n`;
    const out = blankComments(src);
    expect(out).toHaveLength(src.length);
    expect(out.split("\n")).toHaveLength(src.split("\n").length);
  });

  it("keeps code and string contents intact", () => {
    const src = `const url = "https://x.com/a"; // note`;
    const out = blankComments(src);
    expect(out).toContain('"https://x.com/a"');
    expect(out).not.toContain("note");
  });

  it("does not treat a protocol slash as a comment", () => {
    const src = `const u = https://x.com;`;
    expect(blankComments(src)).toContain("x.com");
  });
});

describe("comment false positives", () => {
  it("hardcoded-text ignores JSX-shaped prose inside comments", () => {
    const sources = {
      "src/sections/a.tsx":
        "// header renders outside <main> so the banner landmark. Chrome renders its own <footer>\nconst x = 1;\n",
    };
    expect(hardcodedText.check(ctx({ sources }))).toHaveLength(0);
  });

  it("hardcoded-text ignores code that merely looks like a sentence", () => {
    const sources = {
      "src/sections/a.tsx":
        "const found = list.filter((p) => p.id === id || p.slug === id).length;\n",
    };
    expect(hardcodedText.check(ctx({ sources }))).toHaveLength(0);
  });

  it("hardcoded-text still catches real hardcoded copy", () => {
    const sources = {
      "src/sections/a.tsx": "export const A = () => <p>Free shipping on every order</p>;\n",
    };
    expect(hardcodedText.check(ctx({ sources })).length).toBeGreaterThan(0);
  });

  it("img-missing-alt ignores a comment that mentions <img>", () => {
    const sources = {
      "src/sections/a.tsx":
        "// Undefined -> the <img> renders exactly as before.\nconst x = 1;\n",
    };
    expect(imgMissingAlt.check(ctx({ sources }))).toHaveLength(0);
  });

  it("img-missing-alt still catches a real <img> without alt", () => {
    const sources = {
      "src/sections/a.tsx": 'export const A = () => <img src={url} className="w-full" />;\n',
    };
    expect(imgMissingAlt.check(ctx({ sources })).length).toBeGreaterThan(0);
  });

  it("img-missing-alt stays quiet when alt is present", () => {
    const sources = {
      "src/sections/a.tsx": 'export const A = () => <img src={url} alt={label} />;\n',
    };
    expect(imgMissingAlt.check(ctx({ sources }))).toHaveLength(0);
  });
});
