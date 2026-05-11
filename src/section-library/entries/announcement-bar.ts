import type { SectionLibraryEntry } from "../index";

export const announcementBar: SectionLibraryEntry = {
  slug: "announcement-bar",
  name: "Announcement Bar",
  description: "Thin top-of-page bar for promos / shipping notices, optionally dismissible",
  component: `import type { SectionProps } from "@numueg/theme-sdk";
import { useEffect, useState } from "react";

const DISMISS_KEY = "numu_announcement_dismissed";

export default function AnnouncementBar({ settings }: SectionProps) {
  const message = (settings.message as string) || "";
  const linkLabel = settings.link_label as string | undefined;
  const linkHref = (settings.link_href as string) || "/";
  const dismissible = Boolean(settings.dismissible ?? true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!dismissible) return;
    setDismissed(typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_KEY) === "1");
  }, [dismissible]);

  if (!message || dismissed) return null;

  return (
    <div role="region" aria-label="Announcement" className="bg-gray-900 text-white text-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-3 relative">
        <p>
          {message}
          {linkLabel && (
            <>
              {" "}
              <a href={linkHref} className="underline font-medium ml-1">{linkLabel}</a>
            </>
          )}
        </p>
        {dismissible && (
          <button
            type="button"
            aria-label="Dismiss announcement"
            onClick={() => {
              setDismissed(true);
              try { window.sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
            }}
            className="absolute end-3 text-white/70 hover:text-white"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
`,
  schema: {
    type: "announcement-bar",
    name: "Announcement Bar",
    locales: { ar: { name: "شريط الإعلانات" } },
    settings: [
      { type: "text", id: "message", label: "Message" },
      { type: "text", id: "link_label", label: "Link label (optional)" },
      { type: "url", id: "link_href", label: "Link target" },
      { type: "checkbox", id: "dismissible", label: "Dismissible", default: true },
    ],
  },
};
