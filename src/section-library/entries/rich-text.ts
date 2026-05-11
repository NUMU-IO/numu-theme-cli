import type { SectionLibraryEntry } from "../index";

export const richText: SectionLibraryEntry = {
  slug: "rich-text",
  name: "Rich Text",
  description: "Merchant-edited rich text block — title + paragraph(s) + optional CTA",
  component: `import type { SectionProps } from "@numu/theme-sdk";
import { RichText } from "@numu/theme-sdk";

export default function RichTextSection({ settings }: SectionProps) {
  const heading = (settings.heading as string) || "";
  const body = (settings.body as string) || "";
  const align = (settings.alignment as string) || "left";
  const cls =
    align === "center" ? "text-center mx-auto"
    : align === "right" ? "text-right ml-auto"
    : "text-left";

  return (
    <section className="py-16 px-6">
      <div className={\`max-w-3xl \${cls}\`}>
        {heading && <h2 className="text-2xl md:text-3xl font-semibold mb-6">{heading}</h2>}
        {body && <RichText html={body} className="prose max-w-none" />}
      </div>
    </section>
  );
}
`,
  schema: {
    type: "rich-text",
    name: "Rich Text",
    locales: { ar: { name: "نص منسق" } },
    settings: [
      { type: "text", id: "heading", label: "Heading" },
      { type: "richtext", id: "body", label: "Body" },
      {
        type: "select",
        id: "alignment",
        label: "Alignment",
        default: "left",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ],
      },
    ],
  },
};
