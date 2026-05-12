import type { SectionLibraryEntry } from "../index";

export const countdownTimer: SectionLibraryEntry = {
  slug: "countdown-timer",
  name: "Countdown Timer",
  description: "Sale-end countdown — DD:HH:MM:SS ticking to a merchant-set target date",
  component: `import type { SectionProps } from "@numu/theme-sdk";
import { useEffect, useState } from "react";

function diff(target: number) {
  const ms = Math.max(0, target - Date.now());
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms / 3_600_000) % 24);
  const m = Math.floor((ms / 60_000) % 60);
  const s = Math.floor((ms / 1000) % 60);
  return { d, h, m, s, done: ms === 0 };
}

export default function CountdownTimer({ settings }: SectionProps) {
  const heading = (settings.heading as string) || "Sale ends in";
  const targetIso = settings.end_at as string | undefined;
  const target = targetIso ? Date.parse(targetIso) : 0;
  const [t, setT] = useState(() => diff(target));

  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setT(diff(target)), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (!targetIso) return null;

  return (
    <section className="py-12 px-6 bg-red-50 text-center">
      <h2 className="text-xl md:text-2xl font-semibold mb-4">{heading}</h2>
      {t.done ? (
        <p className="text-lg text-red-700">The sale has ended.</p>
      ) : (
        <div className="flex justify-center gap-4 md:gap-6 font-mono">
          {[
            { label: "days", value: t.d },
            { label: "hrs", value: t.h },
            { label: "min", value: t.m },
            { label: "sec", value: t.s },
          ].map((u) => (
            <div key={u.label} className="bg-white rounded-lg p-3 min-w-[64px] shadow-sm">
              <div className="text-2xl md:text-3xl font-bold">{String(u.value).padStart(2, "0")}</div>
              <div className="text-xs text-gray-500 uppercase">{u.label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
`,
  schema: {
    type: "countdown-timer",
    name: "Countdown Timer",
    locales: { ar: { name: "عداد تنازلي" } },
    settings: [
      { type: "text", id: "heading", label: "Heading", default: "Sale ends in" },
      { type: "text", id: "end_at", label: "End date/time (ISO 8601)", default: "" },
    ],
  },
};
