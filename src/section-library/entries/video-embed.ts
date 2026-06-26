import type { SectionLibraryEntry } from "../index";

export const videoEmbed: SectionLibraryEntry = {
  slug: "video-embed",
  name: "Video Embed",
  description: "Responsive 16:9 video (YouTube / Vimeo / self-hosted MP4)",
  component: `import type { SectionProps } from "@numueg/theme-sdk";
import { useLocale } from "@numueg/theme-sdk";

// Bilingual AR/EN text without a shared import (keeps the snippet forkable).
function useT() {
  const locale = useLocale();
  const isAr =
    typeof locale === "string" && locale.toLowerCase().startsWith("ar");
  return (en: string, ar: string) => (isAr ? ar : en);
}

export default function VideoEmbed({ settings }: SectionProps) {
  const t = useT();
  const heading = (settings.heading as string) || "";
  const url = (settings.video_url as string) || "";
  const poster = (settings.poster as string) || undefined;
  const isMp4 = /\\.(mp4|webm|mov)$/i.test(url);

  return (
    <section className="py-16 px-6 max-w-5xl mx-auto">
      {heading && <h2 className="text-2xl md:text-3xl font-semibold text-center mb-8">{heading}</h2>}
      <div className="aspect-video bg-black rounded-lg overflow-hidden">
        {url ? (
          isMp4 ? (
            <video src={url} poster={poster} controls className="w-full h-full" />
          ) : (
            <iframe
              src={url}
              title={heading || t("Video", "فيديو")}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0"
            />
          )
        ) : (
          <div className="flex items-center justify-center h-full text-white/60">{t("Set a video URL", "أدخل رابط الفيديو")}</div>
        )}
      </div>
    </section>
  );
}
`,
  schema: {
    type: "video-embed",
    name: "Video Embed",
    locales: { ar: { name: "فيديو مضمن" } },
    settings: [
      { type: "text", id: "heading", label: "Heading" },
      { type: "url", id: "video_url", label: "Video URL (YouTube / Vimeo / .mp4)" },
      { type: "image_picker", id: "poster", label: "Poster image (mp4 only)" },
    ],
  },
};
