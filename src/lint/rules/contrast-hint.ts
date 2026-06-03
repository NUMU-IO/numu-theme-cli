/**
 * Rule: contrast-hint  (Phase 5.3 — Shopify's a11y review bar)
 *
 * WCAG 2.2 requires 4.5:1 contrast for normal body text (3:1 for large
 * text). We can't know an element's rendered font size statically, so
 * this is a *hint*: when a CSS rule co-locates a `color:` and a
 * `background`/`background-color:` hex literal, we compute the pair's
 * contrast ratio and warn if it falls below 4.5:1.
 *
 * Only co-located literal pairs are checked — values that come from
 * `var(--theme-*)` tokens (the recommended path) can't be evaluated
 * statically and are skipped (no false positives on themed colors).
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function contrastRatio(
  c1: [number, number, number],
  c2: [number, number, number],
): number {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

const rule: LintRule = {
  id: "contrast-hint",
  description:
    "Co-located color/background hex pairs should meet WCAG 4.5:1 contrast",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    const css = ctx.styles;
    if (!css) return issues;

    // Match `selector { body }` blocks. CSS nesting is rare in theme
    // stylesheets; the flat regex covers the common case.
    const blockRe = /([^{}]*)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(css)) !== null) {
      const rawSelector = m[1].trim().split("\n").pop()?.trim() || m[1].trim();
      const body = m[2];
      const colorM = body.match(/(?:^|[;{\s])color:\s*(#[0-9a-fA-F]{3,6})\b/);
      const bgM = body.match(
        /background(?:-color)?:\s*(#[0-9a-fA-F]{3,6})\b/,
      );
      if (!colorM || !bgM) continue;
      const fg = hexToRgb(colorM[1]);
      const bg = hexToRgb(bgM[1]);
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      if (ratio < 4.5) {
        const line = css.slice(0, m.index).split("\n").length;
        issues.push({
          rule: rule.id,
          severity: "warning",
          file: "styles.css",
          line,
          message: `Low contrast ${ratio.toFixed(2)}:1 for "${rawSelector}" (${colorM[1]} on ${bgM[1]}).`,
          suggestion:
            ratio >= 3
              ? `Meets 3:1 (OK for large text ≥24px/19px-bold) but not the 4.5:1 body-text minimum.`
              : `Below WCAG 4.5:1 — darken/lighten one color, or drive both from a color_scheme so merchants control contrast.`,
        });
      }
    }
    return issues;
  },
};

export default rule;
