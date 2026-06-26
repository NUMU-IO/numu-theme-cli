import type { SectionLibraryEntry } from "../index";

export const multiColumn: SectionLibraryEntry = {
  slug: "multi-column",
  name: "Multi-column",
  description: "2 / 3 / 4-column features grid with icon + heading + text per column",
  component: `import type { SectionProps } from "@numueg/theme-sdk";
import { Block, useLocale } from "@numueg/theme-sdk";

// Bilingual AR/EN text without a shared import (keeps the snippet forkable).
function useT() {
  const locale = useLocale();
  const isAr =
    typeof locale === "string" && locale.toLowerCase().startsWith("ar");
  return (en: string, ar: string) => (isAr ? ar : en);
}

export default function MultiColumn({ settings, blocks, blockOrder }: SectionProps) {
  const t = useT();
  const heading = (settings.heading as string) || "";
  const cols = (settings.columns as number) || 3;
  const gridCols =
    cols === 2 ? "md:grid-cols-2" :
    cols === 4 ? "md:grid-cols-2 lg:grid-cols-4" :
    "md:grid-cols-3";

  // Blocks arrive as a {id: instance} map + an order array — mirror the
  // section→block render: walk the order and look each id up.
  const map = blocks || {};
  const order = blockOrder || Object.keys(map);

  return (
    <section className="py-16 px-6 max-w-7xl mx-auto" aria-label={t("Features", "المميزات")}>
      {heading && (
        <h2 className="text-2xl md:text-3xl font-semibold text-center mb-12">{heading}</h2>
      )}
      <div className={\`grid grid-cols-1 \${gridCols} gap-10\`}>
        {order.map((id) => {
          const b = map[id];
          if (!b || b.type !== "column") return null;
          return (
            <Block key={id} id={id} type={b.type}>
              <div className="text-center">
                {b.settings.icon ? (
                  <img
                    src={b.settings.icon as string}
                    alt=""
                    className="w-12 h-12 mx-auto mb-4"
                  />
                ) : null}
                <h3 className="text-lg font-semibold mb-2">
                  {(b.settings.title as string) || ""}
                </h3>
                <p className="text-gray-600">{(b.settings.text as string) || ""}</p>
              </div>
            </Block>
          );
        })}
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
