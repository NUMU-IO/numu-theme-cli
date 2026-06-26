import type { SectionLibraryEntry } from "../index";

export const collectionList: SectionLibraryEntry = {
  slug: "collection-list",
  name: "Collection List",
  description: "Grid of collection cards (image + name) linking to each collection's PLP",
  component: `import type { SectionProps } from "@numueg/theme-sdk";
import { CollectionCard, useCollections, useLocale } from "@numueg/theme-sdk";

// Bilingual AR/EN text without a shared import (keeps the snippet forkable).
function useT() {
  const locale = useLocale();
  const isAr =
    typeof locale === "string" && locale.toLowerCase().startsWith("ar");
  return (en: string, ar: string) => (isAr ? ar : en);
}

export default function CollectionListSection({ settings }: SectionProps) {
  const t = useT();
  const ids = (settings.collection_ids as string[]) || [];
  const limit = (settings.limit as number) || 6;
  const heading = (settings.heading as string) || t("Shop by collection", "تسوّق حسب المجموعة");
  const { collections: all, loading } = useCollections({ fetchIfMissing: true, limit });
  const collections =
    ids.length > 0 ? all.filter((c) => ids.includes(c.id)) : all;
  if (loading) return <section className="py-16 text-center text-gray-500">{t("Loading…", "جارٍ التحميل…")}</section>;
  if (!collections.length) return null;
  return (
    <section className="py-16 px-6 max-w-7xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-semibold text-center mb-10">{heading}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {collections.slice(0, limit).map((c) => <CollectionCard key={c.id} collection={c} />)}
      </div>
    </section>
  );
}
`,
  schema: {
    type: "collection-list",
    name: "Collection List",
    locales: { ar: { name: "قائمة المجموعات" } },
    settings: [
      { type: "text", id: "heading", label: "Heading", default: "Shop by collection" },
      { type: "collection_list", id: "collection_ids", label: "Collections (empty = newest)" },
      { type: "range", id: "limit", label: "Max collections", min: 2, max: 12, default: 6 },
    ],
  },
};
