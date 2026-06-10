/**
 * 0.3.0 — unit tests for the SSR lint rules (ssr-unsafe-globals,
 * ssr-nondeterministic-render). Proves they fire on render-path hazards
 * and stay quiet on effect-wrapped / guarded / comment occurrences.
 */

import { describe, it, expect } from "vitest";
import ssrUnsafeGlobals from "../lint/rules/ssr-unsafe-globals";
import ssrNondeterministic from "../lint/rules/ssr-nondeterministic-render";
import type { LintContext } from "../lint/runner";

function ctx(sources: Record<string, string>): LintContext {
  return {
    themeDir: ".",
    manifest: {},
    settingsSchema: [],
    sectionSchemas: {},
    blockSchemas: {},
    locales: {},
    sources,
    styles: "",
  };
}

describe("ssr-unsafe-globals", () => {
  it("flags bare window access in the render path", () => {
    const issues = ssrUnsafeGlobals.check(
      ctx({
        "src/sections/hero.tsx": `export default function Hero() {
  const width = window.innerWidth;
  return <section>{width}</section>;
}`,
      }),
    ) as any[];
    expect(issues.length).toBe(1);
    expect(issues[0].rule).toBe("ssr-unsafe-globals");
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].file).toBe("src/sections/hero.tsx");
    expect(issues[0].line).toBe(2);
  });

  it("flags bare localStorage reads at render time", () => {
    const issues = ssrUnsafeGlobals.check(
      ctx({
        "src/sections/cart.tsx": `export default function Cart() {
  const saved = localStorage.getItem("cart");
  return <div>{saved}</div>;
}`,
      }),
    ) as any[];
    expect(issues.length).toBe(1);
  });

  it("stays quiet inside useEffect", () => {
    const issues = ssrUnsafeGlobals.check(
      ctx({
        "src/sections/hero.tsx": `import { useEffect, useState } from "react";
export default function Hero() {
  const [w, setW] = useState(0);
  useEffect(() => {
    setW(window.innerWidth);
    window.addEventListener("resize", () => setW(window.innerWidth));
  }, []);
  return <section>{w}</section>;
}`,
      }),
    ) as any[];
    expect(issues).toEqual([]);
  });

  it("stays quiet behind a typeof guard", () => {
    const issues = ssrUnsafeGlobals.check(
      ctx({
        "src/utils/x.ts": `export function safeOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}`,
      }),
    ) as any[];
    expect(issues).toEqual([]);
  });

  it("stays quiet in event-handler props", () => {
    const issues = ssrUnsafeGlobals.check(
      ctx({
        "src/sections/share.tsx": `export default function Share() {
  return <button onClick={() => {
    navigator.share?.({ url: window.location.href });
  }}>Share</button>;
}`,
      }),
    ) as any[];
    expect(issues).toEqual([]);
  });

  it("ignores comments", () => {
    const issues = ssrUnsafeGlobals.check(
      ctx({
        "src/x.ts": `// reads window.innerWidth lazily after mount
export const a = 1;`,
      }),
    ) as any[];
    expect(issues).toEqual([]);
  });
});

describe("ssr-nondeterministic-render", () => {
  it("flags Date.now() in render", () => {
    const issues = ssrNondeterministic.check(
      ctx({
        "src/sections/countdown.tsx": `export default function Countdown({ until }: { until: number }) {
  const remaining = until - Date.now();
  return <span>{remaining}</span>;
}`,
      }),
    ) as any[];
    expect(issues.length).toBe(1);
    expect(issues[0].rule).toBe("ssr-nondeterministic-render");
    expect(issues[0].line).toBe(2);
  });

  it("flags Math.random() and argless new Date() in render", () => {
    const issues = ssrNondeterministic.check(
      ctx({
        "src/sections/x.tsx": `export default function X() {
  const id = Math.random();
  const now = new Date();
  return <div data-id={id}>{now.toISOString()}</div>;
}`,
      }),
    ) as any[];
    expect(issues.length).toBe(2);
  });

  it("does NOT flag new Date(value) with an argument (deterministic)", () => {
    const issues = ssrNondeterministic.check(
      ctx({
        "src/sections/x.tsx": `export default function X({ ts }: { ts: string }) {
  const d = new Date(ts);
  return <time>{d.toISOString()}</time>;
}`,
      }),
    ) as any[];
    expect(issues).toEqual([]);
  });

  it("stays quiet inside useEffect/setInterval", () => {
    const issues = ssrNondeterministic.check(
      ctx({
        "src/sections/countdown.tsx": `import { useEffect, useState } from "react";
export default function Countdown({ until }: { until: number }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setRemaining(until - Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [until]);
  return <span>{remaining ?? "--"}</span>;
}`,
      }),
    ) as any[];
    expect(issues).toEqual([]);
  });
});
