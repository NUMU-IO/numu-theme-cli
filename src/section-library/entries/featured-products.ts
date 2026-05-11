import type { SectionLibraryEntry } from "../index";

export const featuredProducts: SectionLibraryEntry = {
  slug: "featured-products",
  name: "Featured Products",
  description: "Grid of hand-picked products with title + price + CTA",
  component: `import type { SectionProps } from "@numueg/theme-sdk";
import { ProductCard, useProducts } from "@numueg/theme-sdk";

export default function FeaturedProducts({ settings }: SectionProps) {
  const ids = (settings.product_ids as string[]) || [];
  const limit = (settings.limit as number) || 8;
  const title = (settings.title as string) || "Featured products";

  // When specific products are picked, fetch them; otherwise fetch a
  // top-N list from the store catalog.
  const { products, loading } = useProducts({
    ids: ids.length > 0 ? ids : undefined,
    limit: ids.length > 0 ? undefined : limit,
  });

  if (loading) return <section className="py-16 text-center text-gray-500">Loading…</section>;
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
