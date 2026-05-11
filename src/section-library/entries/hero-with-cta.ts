import type { SectionLibraryEntry } from "../index";

export const heroWithCta: SectionLibraryEntry = {
  slug: "hero-with-cta",
  name: "Hero with Call-to-Action",
  description:
    "Full-bleed hero — headline, subtitle, primary + secondary buttons, optional background image",
  component: `import type { SectionProps } from "@numueg/theme-sdk";
import { useDirection, useTranslation } from "@numueg/theme-sdk";

export default function HeroWithCta({ settings }: SectionProps) {
  const dir = useDirection();
  const { t } = useTranslation();
  const align = (settings.alignment as string) || "center";
  const headline = (settings.headline as string) || t("hero.title", "Welcome");
  const subtitle = (settings.subtitle as string) || "";
  const bg = settings.background_image as string | undefined;
  const cta1 = settings.cta1_label as string | undefined;
  const cta1Href = (settings.cta1_href as string) || "/";
  const cta2 = settings.cta2_label as string | undefined;
  const cta2Href = (settings.cta2_href as string) || "/";

  const justify =
    align === "left" ? "items-start text-left"
    : align === "right" ? "items-end text-right"
    : "items-center text-center";

  return (
    <section
      dir={dir}
      className="relative min-h-[60vh] flex flex-col justify-center px-6 py-20 bg-gray-900 text-white"
      style={
        bg
          ? { backgroundImage: \`url(\${bg})\`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
      }
    >
      {bg && <div className="absolute inset-0 bg-black/50" aria-hidden="true" />}
      <div className={\`relative max-w-4xl mx-auto w-full flex flex-col \${justify}\`}>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">{headline}</h1>
        {subtitle && <p className="mt-6 text-lg md:text-xl text-gray-100 max-w-2xl">{subtitle}</p>}
        {(cta1 || cta2) && (
          <div className="mt-10 flex flex-wrap gap-3">
            {cta1 && (
              <a href={cta1Href} className="bg-white text-gray-900 px-6 py-3 rounded-md font-medium hover:bg-gray-100 transition">
                {cta1}
              </a>
            )}
            {cta2 && (
              <a href={cta2Href} className="border border-white text-white px-6 py-3 rounded-md font-medium hover:bg-white/10 transition">
                {cta2}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
`,
  schema: {
    type: "hero-with-cta",
    name: "Hero with CTA",
    locales: { ar: { name: "بانر رئيسي مع زر دعوة" } },
    settings: [
      {
        type: "text",
        id: "headline",
        label: "Headline",
        locales: { ar: { label: "العنوان" } },
        default: "Welcome to our store",
      },
      {
        type: "textarea",
        id: "subtitle",
        label: "Subtitle",
        locales: { ar: { label: "العنوان الفرعي" } },
      },
      {
        type: "image_picker",
        id: "background_image",
        label: "Background image",
        locales: { ar: { label: "صورة الخلفية" } },
      },
      {
        type: "select",
        id: "alignment",
        label: "Content alignment",
        locales: { ar: { label: "محاذاة المحتوى" } },
        default: "center",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ],
      },
      {
        type: "text",
        id: "cta1_label",
        label: "Primary button label",
        locales: { ar: { label: "نص الزر الرئيسي" } },
      },
      {
        type: "url",
        id: "cta1_href",
        label: "Primary button link",
        locales: { ar: { label: "رابط الزر الرئيسي" } },
        default: "/",
      },
      {
        type: "text",
        id: "cta2_label",
        label: "Secondary button label",
        locales: { ar: { label: "نص الزر الثانوي" } },
      },
      {
        type: "url",
        id: "cta2_href",
        label: "Secondary button link",
        locales: { ar: { label: "رابط الزر الثانوي" } },
        default: "/",
      },
    ],
  },
};
