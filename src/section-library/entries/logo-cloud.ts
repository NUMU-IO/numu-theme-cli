import type { SectionLibraryEntry } from "../index";

export const logoCloud: SectionLibraryEntry = {
  slug: "logo-cloud",
  name: "Logo Cloud",
  description: "Row of partner / press / payment logos in grayscale with hover restore",
  component: `import type { SectionProps, BlockProps } from "@numueg/theme-sdk";

export default function LogoCloud({ settings, blocks }: SectionProps & { blocks?: BlockProps[] }) {
  const heading = (settings.heading as string) || "";
  return (
    <section className="py-12 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        {heading && <p className="text-center text-sm text-gray-500 uppercase tracking-widest mb-8">{heading}</p>}
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {(blocks || []).map((b, i) => {
            const src = b.settings.logo as string | undefined;
            const alt = (b.settings.name as string) || "";
            if (!src) return null;
            const inner = <img src={src} alt={alt} className="h-8 md:h-10 w-auto opacity-60 hover:opacity-100 grayscale hover:grayscale-0 transition" />;
            const href = b.settings.href as string | undefined;
            return href ? <a key={i} href={href} target="_blank" rel="noopener noreferrer">{inner}</a> : <div key={i}>{inner}</div>;
          })}
        </div>
      </div>
    </section>
  );
}
`,
  schema: {
    type: "logo-cloud",
    name: "Logo Cloud",
    locales: { ar: { name: "شعارات الشركاء" } },
    settings: [{ type: "text", id: "heading", label: "Heading" }],
    blocks: [
      {
        type: "logo",
        name: "Logo",
        max_blocks: 24,
        settings: [
          { type: "image_picker", id: "logo", label: "Logo image" },
          { type: "text", id: "name", label: "Brand name (alt)" },
          { type: "url", id: "href", label: "Link (optional)" },
        ],
      },
    ],
  },
};
