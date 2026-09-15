import { describe, it, expect } from "vitest";
import rule from "../lint/rules/no-local-template-helpers";
import type { LintContext, LintIssue } from "../lint/runner";

function check(sources: Record<string, string>): LintIssue[] {
  const ctx: LintContext = {
    themeDir: ".",
    manifest: {},
    settingsSchema: [],
    sectionSchemas: {},
    blockSchemas: {},
    locales: {},
    sources,
    styles: "",
  };
  return rule.check(ctx) as LintIssue[];
}

describe("no-local-template-helpers", () => {
  it("flags exported and unexported local definitions", () => {
    const issues = check({
      "src/sections/_template-utils.ts":
        "export function resolveSections(group) {}\nexport const selectTemplateSections = () => [];\n",
      "src/main.tsx": "function resolveSections(\n  group: GroupLike,\n) {}\n",
    });
    expect(issues.map((i) => `${i.file}:${i.line}`)).toEqual([
      "src/sections/_template-utils.ts:1",
      "src/sections/_template-utils.ts:2",
      "src/main.tsx:1",
    ]);
    expect(issues.every((i) => i.severity === "error")).toBe(true);
  });

  it("allows SDK imports, calls, comments and wrappers", () => {
    const issues = check({
      "src/main.tsx": [
        'import { resolveSections, selectTemplateSections } from "@numueg/theme-sdk";',
        "// function resolveSections( was copied here once",
        "const list = selectTemplateSections(host, builtin, isKnown);",
        "function selectSections(host, builtin) { return selectTemplateSections(host, builtin, isKnown); }",
      ].join("\n"),
    });
    expect(issues).toEqual([]);
  });
});
