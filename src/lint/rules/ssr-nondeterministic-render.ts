/**
 * Rule: ssr-nondeterministic-render (0.3.0)
 *
 * Hydration only succeeds when the server markup and the first client
 * render are byte-identical. `Date.now()`, argless `new Date()`,
 * `Math.random()` and `crypto.randomUUID()` in the render path produce a
 * DIFFERENT value on the server than on the client → React logs a
 * hydration mismatch and re-renders the subtree (flash + wasted work),
 * or in the worst case adopts wrong DOM.
 *
 * Inside effects/handlers/timers they're fine — those run only in the
 * browser, after hydration. Countdown-style sections should read the
 * current time in an effect and store it in state.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";
import {
  computeBrowserOnlyRanges,
  inRanges,
  isCommentLine,
  isImportLine,
} from "./_render-path";

const NONDETERMINISTIC =
  /\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\bMath\.random\s*\(|\bcrypto\.randomUUID\s*\(/;

const rule: LintRule = {
  id: "ssr-nondeterministic-render",
  description:
    "time/random calls in the render path differ between server and client → hydration mismatch",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    for (const [file, source] of Object.entries(ctx.sources)) {
      if (!NONDETERMINISTIC.test(source)) continue;
      const lines = source.split("\n");
      const browserOnly = computeBrowserOnlyRanges(source);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!NONDETERMINISTIC.test(line)) continue;
        if (isCommentLine(line) || isImportLine(line)) continue;
        if (inRanges(i + 1, browserOnly)) continue;
        issues.push({
          rule: rule.id,
          severity: "warning",
          file,
          line: i + 1,
          message:
            "Produces a different value on the server than on the client → hydration mismatch once this theme is SSR-capable.",
          suggestion:
            "Read time/randomness inside useEffect and store it in state (initial render uses a deterministic placeholder).",
        });
      }
    }
    return issues;
  },
};

export default rule;
