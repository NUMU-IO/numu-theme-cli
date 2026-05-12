import type { SectionLibraryEntry } from "../index";

export const faqAccordion: SectionLibraryEntry = {
  slug: "faq-accordion",
  name: "FAQ Accordion",
  description: "Collapsible question/answer pairs using native <details>/<summary>",
  component: `import type { SectionProps, BlockProps } from "@numu/theme-sdk";

export default function FaqAccordion({ settings, blocks }: SectionProps & { blocks?: BlockProps[] }) {
  const heading = (settings.heading as string) || "Frequently asked questions";
  return (
    <section className="py-16 px-6 max-w-3xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-semibold text-center mb-10">{heading}</h2>
      <div className="space-y-3">
        {(blocks || []).map((b, i) => (
          <details key={i} className="bg-white border border-gray-200 rounded-lg group">
            <summary className="cursor-pointer p-4 font-medium list-none flex justify-between items-center group-open:border-b">
              <span>{(b.settings.question as string) || ""}</span>
              <span className="text-gray-400 group-open:rotate-180 transition" aria-hidden="true">▾</span>
            </summary>
            <div className="p-4 text-gray-700 whitespace-pre-wrap">{(b.settings.answer as string) || ""}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
`,
  schema: {
    type: "faq-accordion",
    name: "FAQ Accordion",
    locales: { ar: { name: "الأسئلة الشائعة" } },
    settings: [
      { type: "text", id: "heading", label: "Heading", default: "Frequently asked questions" },
    ],
    blocks: [
      {
        type: "qa",
        name: "Q&A",
        max_blocks: 30,
        settings: [
          { type: "text", id: "question", label: "Question" },
          { type: "textarea", id: "answer", label: "Answer" },
        ],
      },
    ],
  },
};
