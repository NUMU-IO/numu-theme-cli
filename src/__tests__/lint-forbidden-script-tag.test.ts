/**
 * forbidden-script-tag: executable inline scripts are refused, JSON-LD
 * structured data is not (vionne's FAQ emits FAQPage JSON-LD for search
 * engines; the rule used to fail the whole theme on it).
 */

import { describe, it, expect } from "vitest";
import rule from "../lint/rules/forbidden-script-tag";
import type { LintContext } from "../lint/runner";

function ctx(source: string): LintContext {
  return {
    themeDir: ".",
    manifest: {},
    settingsSchema: [],
    sectionSchemas: {},
    blockSchemas: {},
    locales: {},
    sources: { "src/sections/faq.tsx": source },
    styles: "",
  };
}

const issues = (source: string) => rule.check(ctx(source)) as Array<{ line: number }>;

describe("forbidden-script-tag", () => {
  it("flags an executable inline script", () => {
    expect(issues(`<script>window.x = 1</script>`)).toHaveLength(1);
    expect(issues(`<script src="https://evil.example/a.js" />`)).toHaveLength(1);
    expect(issues(`<script type="text/javascript">x()</script>`)).toHaveLength(1);
  });

  it("allows JSON-LD structured data, on one line or across lines", () => {
    expect(
      issues(`<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />`),
    ).toEqual([]);
    expect(issues(`<script\n  type='application/ld+json'\n  dangerouslySetInnerHTML={{ __html: x }}\n/>`)).toEqual([]);
    expect(issues(`<script type={"application/ld+json"}>{x}</script>`)).toEqual([]);
  });

  it("still flags an executable script next to a JSON-LD one", () => {
    const found = issues(
      `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: a }} />\n\n\n<script>run()</script>`,
    );
    expect(found.map((f) => f.line)).toEqual([4]);
  });
});
