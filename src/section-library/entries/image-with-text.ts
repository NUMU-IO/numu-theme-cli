import type { SectionLibraryEntry } from "../index";

export const imageWithText: SectionLibraryEntry = {
  slug: "image-with-text",
  name: "Image with Text",
  description: "Two-column section: image on one side, headline + body + CTA on the other",
  component: `import type { SectionProps } from "@numueg/theme-sdk";
import { useDirection, useLocale } from "@numueg/theme-sdk";

// Bilingual AR/EN text without a shared import (keeps the snippet forkable).
function useT() {
  const locale = useLocale();
  const isAr =
    typeof locale === "string" && locale.toLowerCase().startsWith("ar");
  return (en: string, ar: string) => (isAr ? ar : en);
}

export default function ImageWithText({ settings }: SectionProps) {
  const t = useT();
  const dir = useDirection();
  const image = settings.image as string | undefined;
  const layout = (settings.image_position as string) || "left";
  const heading = (settings.heading as string) || "";
  const body = (settings.body as string) || "";
  const ctaLabel = settings.cta_label as string | undefined;
  const ctaHref = (settings.cta_href as string) || "/";

  // In RTL, "left/right" semantics flip naturally with flex-row-reverse.
  const order = layout === "right" ? "md:flex-row-reverse" : "md:flex-row";

  return (
    <section dir={dir} className="py-16 px-6 max-w-7xl mx-auto">
      <div className={\`flex flex-col gap-10 \${order}\`}>
        <div className="flex-1">
          {image ? (
            <img src={image} alt="" className="w-full h-auto rounded-lg" />
          ) : (
            <div className="aspect-square bg-gray-100 rounded-lg" aria-hidden="true" />
          )}
        </div>
        <div className="flex-1 flex flex-col justify-center">
          {heading && <h2 className="text-3xl font-semibold mb-4">{heading}</h2>}
          {body && <p className="text-gray-700 leading-relaxed">{body}</p>}
          {ctaLabel && (
            <div className="mt-6">
              <a href={ctaHref} className="inline-flex items-center px-6 py-3 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition">
                {ctaLabel}
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
`,
  schema: {
    type: "image-with-text",
    name: "Image with Text",
    locales: { ar: { name: "صورة مع نص" } },
    settings: [
      {
        type: "image_picker",
        id: "image",
        label: "Image",
        locales: { ar: { label: "الصورة" } },
      },
      {
        type: "select",
        id: "image_position",
        label: "Image position",
        locales: { ar: { label: "موضع الصورة" } },
        default: "left",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
      },
      {
        type: "text",
        id: "heading",
        label: "Heading",
        locales: { ar: { label: "العنوان" } },
      },
      {
        type: "textarea",
        id: "body",
        label: "Body text",
        locales: { ar: { label: "النص" } },
      },
      {
        type: "text",
        id: "cta_label",
        label: "Button label (optional)",
        locales: { ar: { label: "نص الزر (اختياري)" } },
      },
      {
        type: "url",
        id: "cta_href",
        label: "Button link",
        locales: { ar: { label: "رابط الزر" } },
        default: "/",
      },
    ],
  },
};
