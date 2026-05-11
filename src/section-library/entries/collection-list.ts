import type { SectionLibraryEntry } from "../index";

export const collectionList: SectionLibraryEntry = {
  slug: "collection-list",
  name: "Collection List",
  description: "Grid of collection cards (image + name) linking to each collection's PLP",
  component: `import type { SectionProps } from "@numueg/theme-sdk";
import { CollectionCard, useCollections } from "@numueg/theme-sdk";

export default function CollectionListSection({ settings }: SectionProps) {
  const ids = (settings.collection_ids as string[]) || [];
  const limit = (settings.limit as number) || 6;
  const heading = (settings.heading as string) || "Shop by collection";
  const { collections, loading } = useCollections({
    ids: ids.length > 0 ? ids : undefined,
    limit: ids.length > 0 ? undefined : limit,
  });
  if (loading) return <section className="py-16 text-center text-gray-500">Loading…</section>;
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
