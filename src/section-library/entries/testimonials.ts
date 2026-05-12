import type { SectionLibraryEntry } from "../index";

export const testimonials: SectionLibraryEntry = {
  slug: "testimonials",
  name: "Testimonials",
  description: "Customer reviews carousel with quote, author, role, optional photo",
  component: `import type { SectionProps, BlockProps } from "@numu/theme-sdk";

export default function Testimonials({ settings, blocks }: SectionProps & { blocks?: BlockProps[] }) {
  const heading = (settings.heading as string) || "What our customers say";
  return (
    <section className="py-16 px-6 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-semibold text-center mb-12">{heading}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(blocks || []).map((b, i) => (
            <figure key={i} className="bg-white p-6 rounded-lg shadow-sm">
              <blockquote className="text-gray-700 italic">"{(b.settings.quote as string) || ""}"</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                {b.settings.photo ? <img src={b.settings.photo as string} alt="" className="w-10 h-10 rounded-full" /> : null}
                <div>
                  <div className="font-medium">{(b.settings.author as string) || ""}</div>
                  {b.settings.role ? <div className="text-sm text-gray-500">{b.settings.role as string}</div> : null}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
`,
  schema: {
    type: "testimonials",
    name: "Testimonials",
    locales: { ar: { name: "آراء العملاء" } },
    settings: [
      { type: "text", id: "heading", label: "Heading", default: "What our customers say" },
    ],
    blocks: [
      {
        type: "testimonial",
        name: "Testimonial",
        max_blocks: 12,
        settings: [
          { type: "textarea", id: "quote", label: "Quote" },
          { type: "text", id: "author", label: "Author" },
          { type: "text", id: "role", label: "Role / company" },
          { type: "image_picker", id: "photo", label: "Photo" },
        ],
      },
    ],
  },
};
