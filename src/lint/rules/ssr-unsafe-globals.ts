/**
 * Rule: ssr-unsafe-globals (0.3.0)
 *
 * SSR-capable themes (plugin ≥ 0.3 emits dist/theme.server.js) execute
 * their render path inside the host's Node worker — where `window`,
 * `document`, `localStorage`, `sessionStorage` and `navigator` do not
 * exist. A bare access during render crashes the server render (the host
 * falls back to client-only mount, silently costing the theme its SSR),
 * or worse, returns server markup that disagrees with the first client
 * render → hydration errors.
 *
 * Allowed and NOT flagged:
 *   - access inside useEffect/useLayoutEffect/event handlers/timers
 *     (browser-only contexts — never run on the server)
 *   - access guarded by `typeof window !== "undefined"` (the SDK idiom)
 *     on the same line or within 3 lines above
 *   - comments and import lines
 */

import type { LintContext, LintIssue, LintRule } from "../runner";
import {
  computeBrowserOnlyRanges,
  inRanges,
  isCommentLine,
  isGuardedNearby,
  isImportLine,
} from "./_render-path";

const BROWSER_GLOBAL =
  /\b(window|document|navigator)\s*\.|\b(localStorage|sessionStorage)\b/;

const rule: LintRule = {
  id: "ssr-unsafe-globals",
  description:
    "browser globals in the render path crash or de-SSR server rendering",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    for (const [file, source] of Object.entries(ctx.sources)) {
      if (!BROWSER_GLOBAL.test(source)) continue;
      const lines = source.split("\n");
      const browserOnly = computeBrowserOnlyRanges(source);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!BROWSER_GLOBAL.test(line)) continue;
        if (isCommentLine(line) || isImportLine(line)) continue;
        if (inRanges(i + 1, browserOnly)) continue;
        if (isGuardedNearby(lines, i)) continue;
        issues.push({
          rule: rule.id,
          severity: "warning",
          file,
          line: i + 1,
          message:
            "Runs during server render once this theme is SSR-capable — " +
            "browser globals don't exist there.",
          suggestion:
            'Guard with `typeof window !== "undefined"`, or move the access into useEffect / an event handler.',
        });
      }
    }
    return issues;
  },
};

export default rule;
