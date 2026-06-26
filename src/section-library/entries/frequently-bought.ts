import type { SectionLibraryEntry } from "../index";

export const frequentlyBought: SectionLibraryEntry = {
  slug: "frequently-bought",
  name: "Frequently Bought Together",
  description:
    "Bundle the current product with related items; checkboxes + one-tap add-all",
  component: `import { useMemo, useState } from "react";
import type { SectionProps } from "@numueg/theme-sdk";
import {
  useProductOptional,
  useRelatedProducts,
  useProducts,
  useCart,
  useLocalization,
  useShop,
  useLocale,
  type Product,
} from "@numueg/theme-sdk";

// --- Standards (self-contained so the snippet stays forkable) -------------
// Bilingual AR/EN text without a shared import.
function useT() {
  const locale = useLocale();
  const isAr =
    typeof locale === "string" && locale.toLowerCase().startsWith("ar");
  return (en: string, ar: string) => (isAr ? ar : en);
}
// Coerce API money (often string-decimals) so totals add instead of concat.
const toNum = (v: unknown) => Number(v) || 0;
// Tolerate images as {url} objects OR raw url strings.
const imgUrl = (p?: Product) => {
  const raw = p?.images?.[0] as unknown;
  return typeof raw === "string"
    ? raw
    : (raw as { url?: string } | undefined)?.url;
};

interface FbtSettings {
  title?: string;
  max_items?: number;
}

/**
 * Frequently bought together — seeds the bundle with the current product and
 * appends related items, falling back to the catalog. Each row is a toggle;
 * "add all" adds every checked product in one pass. Hidden when < 2 items.
 */
export default function FrequentlyBought({ settings }: SectionProps) {
  const s = settings as FbtSettings;
  const t = useT();
  const max = Math.max(2, Math.min(4, s.max_items ?? 3));

  const product = useProductOptional();
  const related = useRelatedProducts(product?.id, { limit: max });
  const catalog = useProducts({ fetchIfMissing: true });
  const { addItem } = useCart();
  const { formatMoney } = useLocalization();
  const shop = useShop();

  const bundle = useMemo(() => {
    const pool = related.items.length > 0 ? related.items : catalog.products;
    const seen = new Set<string>();
    const list: Product[] = [];
    if (product) {
      list.push(product);
      seen.add(product.id);
    }
    for (const p of pool) {
      if (list.length >= max) break;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      list.push(p);
    }
    return list;
  }, [product, related.items, catalog.products, max]);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const isOn = (id: string) => selected[id] !== false; // default on
  const [pending, setPending] = useState(false);

  const currency = product?.currency || shop?.currency;
  const total = bundle
    .filter((p) => isOn(p.id))
    .reduce((sum, p) => sum + toNum(p.price), 0);

  if (bundle.length < 2) return null;

  async function addAll() {
    if (pending) return;
    setPending(true);
    try {
      for (const p of bundle) {
        if (!isOn(p.id)) continue;
        await addItem(p.id, p.variants?.[0]?.id, 1);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="py-12 px-6 max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold mb-4">
        {s.title || t("Frequently bought together", "يُشترى عادةً معاً")}
      </h2>
      <div className="flex flex-wrap items-stretch gap-3">
        {bundle.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3">
            <label className="flex items-center gap-3 border rounded-lg p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isOn(p.id)}
                onChange={(e) =>
                  setSelected((prev) => ({ ...prev, [p.id]: e.target.checked }))
                }
              />
              {imgUrl(p) ? (
                <img
                  src={imgUrl(p)}
                  alt={p.name}
                  loading="lazy"
                  className="w-12 h-12 object-cover rounded"
                />
              ) : (
                <span className="w-12 h-12 rounded bg-gray-100" />
              )}
              <span className="text-sm">
                <span className="block font-medium">{p.name}</span>
                <span className="block text-gray-500">
                  {formatMoney(toNum(p.price), currency)}
                </span>
              </span>
            </label>
            {i < bundle.length - 1 ? (
              <span className="text-gray-400" aria-hidden="true">
                +
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-5">
        <p className="text-sm">
          {t("Total", "الإجمالي")}:{" "}
          <strong>{formatMoney(total, currency)}</strong>
        </p>
        <button
          type="button"
          disabled={pending || total <= 0}
          onClick={addAll}
          className="px-5 py-2.5 rounded-full bg-black text-white text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "…" : t("Add all to cart", "أضف الكل للسلة")}
        </button>
      </div>
    </section>
  );
}
`,
  schema: {
    type: "frequently-bought",
    name: "Frequently Bought Together",
    locales: { ar: { name: "يُشترى معاً" } },
    settings: [
      {
        type: "text",
        id: "title",
        label: "Section title",
        locales: { ar: { label: "عنوان القسم" } },
        default: "Frequently bought together",
      },
      {
        type: "range",
        id: "max_items",
        label: "Max items in bundle",
        locales: { ar: { label: "أقصى عدد للمنتجات" } },
        min: 2,
        max: 4,
        default: 3,
      },
    ],
  },
};
