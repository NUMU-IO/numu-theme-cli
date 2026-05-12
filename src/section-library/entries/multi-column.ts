import type { SectionLibraryEntry } from "../index";

export const multiColumn: SectionLibraryEntry = {
  slug: "multi-column",
  name: "Multi-column",
  description: "2 / 3 / 4-column features grid with icon + heading + text per column",
  component: `import type { SectionProps, BlockProps } from "@numu/theme-sdk";
import { Block } from "@numu/theme-sdk";

export default function MultiColumn({ settings, blocks }: SectionProps & { blocks?: BlockProps[] }) {
  const heading = (settings.heading as string) || "";
  const cols = (settings.columns as number) || 3;
  const gridCols =
    cols === 2 ? "md:grid-cols-2" :
    cols === 4 ? "md:grid-cols-2 lg:grid-cols-4" :
    "md:grid-cols-3";

  return (
    <section className="py-16 px-6 max-w-7xl mx-auto">
      {heading && (
        <h2 className="text-2xl md:text-3xl font-semibold text-center mb-12">{heading}</h2>
      )}
      <div className={\`grid grid-cols-1 \${gridCols} gap-10\`}>
        {(blocks || []).map((block, i) => (
          <Block key={i} block={block}>
            {block.type === "column" && (
              <div className="text-center">
                {block.settings.icon ? (
                  <img
                    src={block.settings.icon as string}
                    alt=""
                    className="w-12 h-12 mx-auto mb-4"
                  />
                ) : null}
                <h3 className="text-lg font-semibold mb-2">
                  {(block.settings.title as string) || ""}
                </h3>
                <p className="text-gray-600">{(block.settings.text as string) || ""}</p>
              </div>
            )}
          </Block>
        ))}
      </div>
    </section>
  );
}
`,
  schema: {
    type: "multi-column",
    name: "Multi-column",
    locales: { ar: { name: "أعمدة متعددة" } },
    settings: [
      {
        type: "text",
        id: "heading",
        label: "Section heading",
        locales: { ar: { label: "عنوان القسم" } },
      },
      {
        type: "range",
        id: "columns",
        label: "Number of columns",
        locales: { ar: { label: "عدد الأعمدة" } },
        min: 2,
        max: 4,
        default: 3,
      },
    ],
    blocks: [
      {
        type: "column",
        name: "Column",
        locales: { ar: { name: "عمود" } },
        max_blocks: 8,
        settings: [
          {
            type: "image_picker",
            id: "icon",
            label: "Icon",
            locales: { ar: { label: "أيقونة" } },
          },
          {
            type: "text",
            id: "title",
            label: "Title",
            locales: { ar: { label: "العنوان" } },
          },
          {
            type: "textarea",
            id: "text",
            label: "Text",
            locales: { ar: { label: "النص" } },
          },
        ],
      },
    ],
  },
};
