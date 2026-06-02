/**
 * Phase 5.3 — unit tests for the a11y lint rules (contrast-hint,
 * touch-target). Proves they fire on sub-threshold CSS and stay quiet on
 * compliant / token-driven CSS (no false positives).
 */

import { describe, it, expect } from "vitest";
import contrastHint from "../lint/rules/contrast-hint";
import touchTarget from "../lint/rules/touch-target";
import type { LintContext } from "../lint/runner";

function ctx(styles: string): LintContext {
  return {
    themeDir: ".",
    manifest: {},
    settingsSchema: [],
    sectionSchemas: {},
    blockSchemas: {},
    locales: {},
    sources: {},
    styles,
  };
}

describe("contrast-hint", () => {
  it("flags a low-contrast color/background hex pair", () => {
    const issues = contrastHint.check(ctx(".badge { color: #aaa; background: #fff; }")) as any[];
    expect(issues.length).toBe(1);
    expect(issues[0].rule).toBe("contrast-hint");
    expect(issues[0].severity).toBe("warning");
  });

  it("passes a compliant pair (black on white)", () => {
    const issues = contrastHint.check(ctx(".t { color: #000; background: #fff; }")) as any[];
    expect(issues).toEqual([]);
  });

  it("skips token-driven colors it can't evaluate statically", () => {
    const issues = contrastHint.check(
      ctx(".t { color: var(--theme-color-text); background: #fff; }"),
    ) as any[];
    expect(issues).toEqual([]);
  });

  it("no styles → no issues", () => {
    expect(contrastHint.check(ctx(""))).toEqual([]);
  });
});

describe("touch-target", () => {
  it("flags an interactive element below 24px", () => {
    const issues = touchTarget.check(ctx(".btn { width: 16px; height: 16px; }")) as any[];
    expect(issues.length).toBe(1);
    expect(issues[0].rule).toBe("touch-target");
  });

  it("flags a bare button with a small min-width", () => {
    const issues = touchTarget.check(ctx("button { min-width: 12px; }")) as any[];
    expect(issues.length).toBe(1);
  });

  it("ignores pseudo-element decoration (a::after underline)", () => {
    const issues = touchTarget.check(ctx(".nav a::after { height: 1px; }")) as any[];
    expect(issues).toEqual([]);
  });

  it("passes an adequately-sized button", () => {
    const issues = touchTarget.check(
      ctx("button { width: 44px; height: 44px; }"),
    ) as any[];
    expect(issues).toEqual([]);
  });

  it("ignores non-interactive selectors", () => {
    const issues = touchTarget.check(ctx(".card { width: 10px; }")) as any[];
    expect(issues).toEqual([]);
  });
});
