/**
 * Shared render-path heuristics for the SSR lint rules (0.3.0).
 *
 * Both `ssr-unsafe-globals` and `ssr-nondeterministic-render` care about
 * the same question: does this expression run during RENDER (where it
 * executes on the server / breaks hydration determinism), or inside an
 * effect / event handler / timer callback (where it only ever runs in the
 * browser, after hydration)?
 *
 * We answer it with line-level heuristics, not a real parser — same
 * trade-off every other rule in this linter makes. Brace/paren counting
 * from the opening line of an effect/handler tracks its extent well
 * enough for idiomatic theme code; the rules emit `warning` severity so a
 * false positive never blocks a non-strict build.
 */

/** Lines that OPEN a browser-only execution context. */
const CALLBACK_OPENERS =
  /\b(useEffect|useLayoutEffect|useInsertionEffect|addEventListener|removeEventListener|setTimeout|setInterval|requestAnimationFrame|requestIdleCallback)\s*\(|\bon[A-Z]\w*\s*=\s*\{/;

/** 1-based inclusive line ranges that are browser-only contexts. */
export function computeBrowserOnlyRanges(
  source: string,
): Array<[number, number]> {
  const lines = source.split("\n");
  const ranges: Array<[number, number]> = [];

  for (let i = 0; i < lines.length; i++) {
    if (!CALLBACK_OPENERS.test(lines[i])) continue;
    // Count net delimiter depth from the opener line until it returns to
    // zero — that's the callback's extent. Strings/comments can skew the
    // count; acceptable for warning-severity heuristics.
    let depth = 0;
    let started = false;
    let end = i;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "(" || ch === "{") {
          depth++;
          started = true;
        } else if (ch === ")" || ch === "}") {
          depth--;
        }
      }
      if (started && depth <= 0) {
        end = j;
        break;
      }
      end = j;
    }
    ranges.push([i + 1, end + 1]);
  }
  return ranges;
}

export function inRanges(
  line: number,
  ranges: Array<[number, number]>,
): boolean {
  return ranges.some(([start, end]) => line >= start && line <= end);
}

/** `typeof window` / `typeof document` guard on the same line or within
 *  the three lines above — the SDK's own guard idiom. */
export function isGuardedNearby(lines: string[], idx: number): boolean {
  for (let i = Math.max(0, idx - 3); i <= idx; i++) {
    if (/typeof\s+(window|document|navigator|localStorage|sessionStorage)\b/.test(lines[i])) {
      return true;
    }
  }
  return false;
}

export function isCommentLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

export function isImportLine(line: string): boolean {
  return /^\s*import\b/.test(line);
}
