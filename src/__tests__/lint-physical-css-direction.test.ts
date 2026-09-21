/**
 * Unit tests for the `physical-css-direction` lint rule.
 *
 * NUMU is Arabic-first, so a theme spends at least half its life under
 * `dir="rtl"`. The rule's value depends on both halves:
 *
 *   1. it FIRES on physical directions (`ml-4`, `text-right`, `margin-left`),
 *      which pin an element to one side and mirror wrong in the other; and
 *   2. it does NOT fire on the logical equivalents, nor on lines that scope
 *      a utility with Tailwind's `rtl:` / `ltr:` variants — those are a
 *      deliberate per-direction override, and a rule that flagged them would
 *      be switched off, after which it guards nothing.
 */

import { describe, expect, it } from "vitest";
import rule from "../lint/rules/physical-css-direction";
import type { LintContext, LintIssue } from "../lint/runner";

function ctx(sources: Record<string, string>, styles = ""): LintContext {
  return {
    themeDir: ".",
    manifest: {},
    settingsSchema: [],
    sectionSchemas: {},
    blockSchemas: {},
    locales: {},
    sources,
    styles,
  };
}

const run = (c: LintContext) => rule.check(c) as LintIssue[];

describe("physical-css-direction", () => {
  it("flags physical Tailwind utilities and names the logical replacement", () => {
    const issues = run(
      ctx({
        "src/sections/hero.tsx": '<div className="ml-4 text-right">x</div>\n',
      }),
    );

    expect(issues.map((i) => i.suggestion)).toEqual([
      "Use ms- instead.",
      "Use text-end instead.",
    ]);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].file).toBe("src/sections/hero.tsx");
    expect(issues[0].line).toBe(1);
  });

  it("flags physical properties in styles.css", () => {
    const issues = run(ctx({}, ".badge { margin-left: 8px; float: right; }\n"));

    expect(issues.map((i) => i.suggestion)).toEqual([
      "Use margin-inline-start instead.",
      "Use float: inline-start / inline-end instead.",
    ]);
    expect(issues[0].file).toBe("styles.css");
  });

  it("stays quiet on logical utilities and properties", () => {
    expect(
      run(
        ctx(
          {
            "src/sections/hero.tsx":
              '<div className="ms-4 pe-2 text-start border-s rounded-e start-0">x</div>\n',
          },
          ".badge { margin-inline-start: 8px; text-align: start; }\n",
        ),
      ),
    ).toEqual([]);
  });

  it("stays quiet on direction-scoped overrides", () => {
    expect(
      run(
        ctx(
          {
            "src/sections/nav.tsx":
              '<i className="ltr:ml-2 rtl:mr-2 rtl:rotate-180" />\n',
          },
          '[dir="rtl"] .drawer { left: auto; right: 0; }\n',
        ),
      ),
    ).toEqual([]);
  });

  it("does not fire on a comment that names the utility it warns against", () => {
    expect(
      run(
        ctx({
          "src/sections/promo.tsx":
            '{/* `text-start`, not `text-left`: this renders in Arabic too. */}\n' +
            '<div className="md:text-start">x</div>\n',
        }),
      ),
    ).toEqual([]);
  });

  it("does not fire on words that merely contain a utility name", () => {
    expect(
      run(
        ctx({
          "src/lib/format.ts":
            'const html = "<b>x</b>";\nconst xml_ = "no";\nconst copyright = 1;\n',
        }),
      ),
    ).toEqual([]);
  });
});
