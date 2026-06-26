import type { SectionLibraryEntry } from "../index";

export const featuredProducts: SectionLibraryEntry = {
  slug: "featured-products",
  name: "Featured Products",
  description: "Grid of hand-picked products with title + price + CTA",
  component: `import type { SectionProps } from "@numueg/theme-sdk";
import { ProductCard, useProducts, useLocale } from "@numueg/theme-sdk";

// Bilingual AR/EN text without a shared import (keeps the snippet forkable).
function useT() {
  const locale = useLocale();
  const isAr =
    typeof locale === "string" && locale.toLowerCase().startsWith("ar");
  return (en: string, ar: string) => (isAr ? ar : en);
}

export default function FeaturedProducts({ settings }: SectionProps) {
  const t = useT();
  const ids = (settings.product_ids as string[]) || [];
  const limit = (settings.limit as number) || 8;
  const title = (settings.title as string) || t("Featured products", "منتجات مميزة");

  // Pull the catalog (fetching if the route didn't pre-load it), then narrow
  // to the merchant's hand-picked ids when provided, else take the top-N.
  const { products: all, loading } = useProducts({ fetchIfMissing: true, limit });
  const products =
    ids.length > 0 ? all.filter((p) => ids.includes(p.id)) : all;

  if (loading) return <section className="py-16 text-center text-gray-500">{t("Loading…", "جارٍ التحميل…")}</section>;
  if (!products.length) return null;

  return (
    <section className="py-16 px-6 max-w-7xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-semibold mb-8 text-center">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.slice(0, limit).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
`,
  schema: {
    type: "featured-products",
    name: "Featured Products",
    locales: { ar: { name: "منتجات مميزة" } },
    settings: [
      {
        type: "text",
        id: "title",
        label: "Section title",
        locales: { ar: { label: "عنوان القسم" } },
        default: "Featured products",
      },
      {
        type: "product_list",
        id: "product_ids",
        label: "Products to feature (leave empty for top-N)",
        locales: { ar: { label: "المنتجات المميزة (فارغ = الأعلى مبيعًا)" } },
      },
      {
        type: "range",
        id: "limit",
        label: "Max products",
        locales: { ar: { label: "الحد الأقصى" } },
        min: 2,
        max: 24,
        default: 8,
      },
    ],
  },
};
