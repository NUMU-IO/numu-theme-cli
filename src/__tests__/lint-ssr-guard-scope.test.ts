/**
 * Regression tests for the `ssr-unsafe-globals` render-path heuristics.
 *
 * These cover the two shapes that made the rule fire on the platform's OWN
 * starter theme — three warnings on a freshly scaffolded `numu-theme init`,
 * every one of them wrong:
 *
 *   1. An EARLY-RETURN guard more than three lines above the access, and in
 *      an enclosing block rather than the same one. The old check looked at a
 *      fixed three-line window, so it lost the guard almost immediately.
 *   2. `navigator.clipboard` inside a plain `function copyLink()` that is
 *      only ever reached via `onClick={copyLink}`. The opener regex matched
 *      inline arrows but never a handler passed by reference.
 *
 * A warning a reader knows is wrong is worse than no warning: it teaches
 * theme authors to skim past this rule, and it is the only thing standing
 * between a theme and a crashed server render.
 *
 * So each case asserts BOTH directions — the false positive is gone AND the
 * genuine defect it resembles is still reported. Widening a heuristic until
 * it reports nothing is not a fix.
 */

import { describe, expect, it } from "vitest";
import rule from "../lint/rules/ssr-unsafe-globals";
import type { LintContext } from "../lint/runner";

function ctx(source: string): LintContext {
  return {
    themeDir: ".",
    manifest: {},
    settingsSchema: [],
    sectionSchemas: {},
    blockSchemas: {},
    locales: {},
    sources: { "src/lib/Widget.tsx": source },
    styles: "",
  };
}

const run = (source: string) => rule.check(ctx(source)) as Array<{
  line?: number;
}>;

describe("ssr-unsafe-globals — early-return guards", () => {
  it("honours a guard far above the access, with the return on the SAME line", () => {
    // 8 lines of separation: well past the old three-line window.
    const issues = run(`export function focus(ref) {
  const el = ref.current;
  if (typeof window === "undefined") return;
  el.setAttribute("contenteditable", "true");
  el.focus();
  const a = 1;
  const b = 2;
  const sel = window.getSelection();
  return sel;
}
`);
    expect(issues).toEqual([]);
  });

  it("honours a guard whose `return` wrapped onto the next line", () => {
    // Exactly how prettier formats the starter's two-clause guard.
    const issues = run(`export function focus(ref) {
  const el = ref.current;
  if (!el || typeof window === "undefined" || typeof document === "undefined")
    return;
  el.focus();
  const sel = window.getSelection();
  return sel;
}
`);
    expect(issues).toEqual([]);
  });

  it("honours an outer-block guard from inside a nested block", () => {
    // The guard ends the whole function, so it protects nested blocks too.
    // The scan must step out into ancestor scopes instead of stopping at the
    // first enclosing brace — this is the `document.createRange()` case.
    const issues = run(`export function focus(ref) {
  if (typeof window === "undefined" || typeof document === "undefined")
    return;
  const sel = window.getSelection();
  if (sel) {
    const range = document.createRange();
    sel.addRange(range);
  }
}
`);
    expect(issues).toEqual([]);
  });

  it("STILL flags an unguarded access in the render path", () => {
    const issues = run(`export function Widget() {
  const width = window.innerWidth;
  return <div>{width}</div>;
}
`);
    expect(issues.length).toBe(1);
    expect(issues[0].line).toBe(2);
  });

  it("does NOT let a guard in one function protect a different one", () => {
    // The guard belongs to `safe`; `unsafe` is a separate invocation and must
    // still be reported. This is the false-negative the scope walk could
    // introduce if it never stopped at a function boundary.
    const issues = run(`export function safe() {
  if (typeof window === "undefined") return;
  return window.innerWidth;
}

export function unsafe() {
  return document.title;
}
`);
    expect(issues.length).toBe(1);
    expect(issues[0].line).toBe(7);
  });
});

describe("ssr-unsafe-globals — handlers passed by reference", () => {
  it("does not flag a browser global inside a function used as onClick={fn}", () => {
    const issues = run(`export function Share({ url }) {
  function copyLink() {
    navigator.clipboard?.writeText(url);
  }
  return <button onClick={copyLink}>Copy</button>;
}
`);
    expect(issues).toEqual([]);
  });

  it("also covers a const arrow handler passed by reference", () => {
    const issues = run(`export function Share({ url }) {
  const copyLink = () => {
    navigator.clipboard?.writeText(url);
  };
  return <button onClick={copyLink}>Copy</button>;
}
`);
    expect(issues).toEqual([]);
  });

  it("STILL flags the same call when the function is NOT wired to a handler", () => {
    // Identical body, no `onClick={copyLink}` — so it is render-path code and
    // would crash the server render. The rule must not go quiet just because
    // a function happens to look like a handler.
    const issues = run(`export function Share({ url }) {
  function copyLink() {
    navigator.clipboard?.writeText(url);
  }
  copyLink();
  return <button>Copy</button>;
}
`);
    expect(issues.length).toBe(1);
    expect(issues[0].line).toBe(3);
  });
});
