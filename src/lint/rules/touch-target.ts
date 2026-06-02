/**
 * Rule: touch-target  (Phase 5.3 — Shopify's a11y review bar)
 *
 * WCAG 2.2 (2.5.8) asks interactive targets to be at least 24×24 CSS px.
 * Statically we can catch the clear violations: a CSS rule whose selector
 * targets an interactive element (button / a / [role=button] / .btn /
 * input[type=button|submit|reset]) and pins an explicit width/height (or
 * min-*) below 24px.
 *
 * A hint, not a hard gate — padding/line-height can still produce a large
 * enough hit area, so this is a warning, and only fires on explicit small
 * px dimensions.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

const INTERACTIVE =
  /(^|[\s,>+~])(button|a|\.btn\b|\[role=["']?button["']?\]|input\[type=["']?(?:button|submit|reset)["']?\])/i;

const DIM_PROPS = ["width", "height", "min-width", "min-height"];

const rule: LintRule = {
  id: "touch-target",
  description: "Interactive targets should be ≥ 24×24px (WCAG 2.5.8)",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    const css = ctx.styles;
    if (!css) return issues;

    const blockRe = /([^{}]*)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(css)) !== null) {
      const rawSelector = m[1].trim().split("\n").pop()?.trim() || m[1].trim();
      // Pseudo-elements (::before/::after/::placeholder) are generated
      // decoration, not the clickable box — a 1px underline is fine.
      if (rawSelector.includes("::")) continue;
      if (!INTERACTIVE.test(rawSelector)) continue;
      const body = m[2];
      for (const prop of DIM_PROPS) {
        const pm = body.match(
          new RegExp(`(?:^|[;{\\s])${prop}:\\s*([0-9.]+)px\\b`),
        );
        if (!pm) continue;
        const px = parseFloat(pm[1]);
        if (px > 0 && px < 24) {
          const line = css.slice(0, m.index).split("\n").length;
          issues.push({
            rule: rule.id,
            severity: "warning",
            file: "styles.css",
            line,
            message: `Interactive "${rawSelector}" sets ${prop}: ${px}px (< 24px touch target).`,
            suggestion: `Give clickable elements a ≥24×24px hit area (min-width/min-height: 24px or adequate padding).`,
          });
          break; // one finding per rule block is enough signal
        }
      }
    }
    return issues;
  },
};

export default rule;
