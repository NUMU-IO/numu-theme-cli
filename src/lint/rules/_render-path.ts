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

/**
 * Names bound to a JSX event prop by reference — `onClick={copyLink}`.
 *
 * Such a function is a browser-only context just as surely as an inline
 * arrow is, but it is DECLARED elsewhere, so the opener regex above never
 * sees it. Missing this reported `navigator.clipboard` inside a plain
 * `function copyLink()` as render-path code, in the platform's own starter
 * theme — a false positive in the first file most theme authors read.
 *
 * Deliberately reference-only: `onClick={() => copyLink()}` already matches
 * CALLBACK_OPENERS, and `onClick={cond ? a : b}` is not a bare identifier.
 */
function handlerNames(source: string): Set<string> {
  const names = new Set<string>();
  const re = /\bon[A-Z]\w*\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) names.add(m[1]);
  return names;
}

/** Does this line DECLARE one of `names` as a function? */
function declaresHandler(line: string, names: Set<string>): boolean {
  for (const n of names) {
    const id = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // `function copyLink(` | `const copyLink = (…) =>` | `const copyLink = function`
    const decl = new RegExp(
      `\\bfunction\\s+${id}\\s*\\(|\\b(?:const|let|var)\\s+${id}\\s*(?::[^=]+)?=\\s*(?:async\\s+)?(?:function\\b|\\()`,
    );
    if (decl.test(line)) return true;
  }
  return false;
}

/** 1-based inclusive line ranges that are browser-only contexts. */
export function computeBrowserOnlyRanges(
  source: string,
): Array<[number, number]> {
  const lines = source.split("\n");
  const ranges: Array<[number, number]> = [];
  const handlers = handlerNames(source);

  for (let i = 0; i < lines.length; i++) {
    if (
      !CALLBACK_OPENERS.test(lines[i]) &&
      !(handlers.size > 0 && declaresHandler(lines[i], handlers))
    ) {
      continue;
    }
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

const TYPEOF_GUARD =
  /typeof\s+(window|document|navigator|localStorage|sessionStorage)\b/;

/** Line that opens a new function scope — the limit of a guard's reach. */
const FUNCTION_OPENER =
  /\bfunction\b|=>\s*[({]|\b(?:const|let|var)\s+[\w$]+\s*(?::[^=]+)?=\s*(?:async\s+)?\(/;

/**
 * Is the access on line `idx` protected by a `typeof window` guard?
 *
 * Two shapes count:
 *
 *  1. A guard on the same line or within the three above — the SDK's inline
 *     idiom, `typeof window !== "undefined" && window.foo`.
 *
 *  2. An EARLY-RETURN guard anywhere above it in the same block:
 *
 *       if (typeof window === "undefined") return;
 *       …
 *       const sel = window.getSelection();   // ← 6 lines later, still safe
 *
 *     That shape protects every line after it until the block closes, but
 *     the old fixed three-line window lost sight of it almost immediately —
 *     it flagged two already-guarded lines in the starter's own
 *     EditableText, 4 and 6 lines past their guard. Walking back to the
 *     enclosing block's opening brace honours the guard's real scope
 *     without needing a parser.
 */
export function isGuardedNearby(lines: string[], idx: number): boolean {
  for (let i = Math.max(0, idx - 3); i <= idx; i++) {
    if (TYPEOF_GUARD.test(lines[i])) return true;
  }

  // Scan upwards tracking net brace depth. A `}` met first closed a nested
  // block BELOW us, so its contents are out of scope (depth > 0 — skip).
  // Depth going negative means we stepped out into an ANCESTOR block, which
  // is still in scope: an early return in the enclosing block ends the whole
  // function, so it protects nested blocks too. That is why the scan does not
  // stop there — it stops at the function boundary, past which a guard
  // belongs to a different invocation entirely.
  let depth = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const line = lines[i];
    for (let c = line.length - 1; c >= 0; c--) {
      const ch = line[c];
      if (ch === "}") depth++;
      else if (ch === "{") depth--;
    }
    // The `return` may sit on the guard's own line or wrap to the next one —
    // prettier splits a long condition exactly that way, which is how the
    // starter's own two-clause guard (`!el || typeof window === "undefined"`)
    // ended up with its `return` on the following line.
    const guarded =
      TYPEOF_GUARD.test(line) &&
      (/\breturn\b/.test(line) || /\breturn\b/.test(lines[i + 1] ?? ""));
    if (depth <= 0 && guarded) return true;
    if (depth < 0 && FUNCTION_OPENER.test(line)) return false;
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
