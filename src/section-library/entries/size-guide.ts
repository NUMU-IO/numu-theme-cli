import type { SectionLibraryEntry } from "../index";

export const sizeGuide: SectionLibraryEntry = {
  slug: "size-guide",
  name: "Size Guide",
  description:
    "Size-chart trigger + modal table, resolved from the product/store size chart",
  component: `import { useState } from "react";
import type { SectionProps } from "@numueg/theme-sdk";
import { useProductSizeChart, useLocale } from "@numueg/theme-sdk";

// Bilingual AR/EN text without a shared import (keeps the snippet forkable).
function useT() {
  const locale = useLocale();
  const isAr =
    typeof locale === "string" && locale.toLowerCase().startsWith("ar");
  return (en: string, ar: string) => (isAr ? ar : en);
}

/**
 * Size guide — renders a trigger button and a modal table. The chart is
 * resolved by the SDK from the product chart (\`product.attributes.size_chart\`)
 * with a fallback to the store-wide default. Renders nothing when there's no
 * chart to show, or when an enabled chart is still empty.
 */
export default function SizeGuide({ settings }: SectionProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const chart = useProductSizeChart();

  const hasContent =
    !!chart &&
    ((chart.rows?.length ?? 0) > 0 || Boolean(chart.image_url));
  if (!hasContent || !chart) return null;

  const label = (settings.label as string) || t("Size guide", "دليل المقاسات");

  return (
    <div className="py-4 px-6 max-w-3xl mx-auto">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
      >
        {label}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="relative bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {label}
                {chart.unit ? " (" + chart.unit + ")" : ""}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("Close", "إغلاق")}
                className="p-1"
              >
                ✕
              </button>
            </div>
            {chart.image_url ? (
              <img
                src={chart.image_url}
                alt=""
                className="w-full rounded mb-4"
              />
            ) : null}
            {chart.rows?.length ? (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-start p-2 border-b">
                      {t("Size", "المقاس")}
                    </th>
                    {chart.column_headers.map((h, i) => (
                      <th key={i} className="text-start p-2 border-b">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chart.rows.map((row, ri) => (
                    <tr key={ri}>
                      <th scope="row" className="text-start p-2 border-b font-medium">
                        {row.size}
                      </th>
                      {chart.column_headers.map((_, ci) => (
                        <td key={ci} className="p-2 border-b">
                          {row.values[ci] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {chart.notes ? (
              <p className="text-xs text-gray-500 mt-4">{chart.notes}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
`,
  schema: {
    type: "size-guide",
    name: "Size Guide",
    locales: { ar: { name: "دليل المقاسات" } },
    settings: [
      {
        type: "text",
        id: "label",
        label: "Trigger label",
        locales: { ar: { label: "نص الزر" } },
        default: "Size guide",
      },
    ],
  },
};
