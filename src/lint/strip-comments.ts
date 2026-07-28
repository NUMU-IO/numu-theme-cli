/**
 * Blank out comments while preserving line/column positions.
 *
 * Source-scanning lint rules match patterns like `>text<` to find JSX copy.
 * Code COMMENTS routinely contain the same shapes — a comment explaining
 * "header renders outside <main> … its own <footer>" reads as JSX text to a
 * regex, and the rule reports a hardcoded string that does not exist. That
 * noise lands in the certification signal the publish gate now enforces, so
 * it is worth removing properly rather than tolerating.
 *
 * Comment bodies are replaced with spaces (never removed) so every
 * subsequent index, line number and column stays exactly where it was.
 * String literals are respected, so a `//` inside "https://…" is not treated
 * as a comment.
 */
export function blankComments(source: string): string {
  const out = source.split("");
  const n = source.length;
  let i = 0;
  type State = "code" | "line" | "block" | "single" | "double" | "template";
  let state: State = "code";

  const blank = (idx: number) => {
    if (out[idx] !== "\n") out[idx] = " ";
  };

  while (i < n) {
    const c = source[i];
    const next = source[i + 1];

    switch (state) {
      case "code":
        if (c === "/" && next === "/") {
          // `https://` — a protocol slash, not a comment.
          if (source[i - 1] === ":") {
            i += 2;
            break;
          }
          state = "line";
          blank(i);
          blank(i + 1);
          i += 2;
        } else if (c === "/" && next === "*") {
          state = "block";
          blank(i);
          blank(i + 1);
          i += 2;
        } else if (c === "'") {
          state = "single";
          i++;
        } else if (c === '"') {
          state = "double";
          i++;
        } else if (c === "`") {
          state = "template";
          i++;
        } else {
          i++;
        }
        break;

      case "line":
        if (c === "\n") {
          state = "code";
          i++;
        } else {
          blank(i);
          i++;
        }
        break;

      case "block":
        if (c === "*" && next === "/") {
          blank(i);
          blank(i + 1);
          state = "code";
          i += 2;
        } else {
          blank(i);
          i++;
        }
        break;

      case "single":
      case "double":
      case "template": {
        const quote = state === "single" ? "'" : state === "double" ? '"' : "`";
        if (c === "\\") {
          i += 2; // escaped char — skip both
        } else if (c === quote) {
          state = "code";
          i++;
        } else {
          i++;
        }
        break;
      }
    }
  }

  return out.join("");
}
