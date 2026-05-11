import type { SectionLibraryEntry } from "../index";

export const featuredBlogPosts: SectionLibraryEntry = {
  slug: "featured-blog-posts",
  name: "Featured Blog Posts",
  description: "3-up grid of recent blog articles with cover image + title + excerpt",
  component: `import type { SectionProps } from "@numu/theme-sdk";

interface Article {
  handle: string;
  title: string;
  excerpt?: string | null;
  published_at?: string | null;
  cover_image?: string | null;
}

export default function FeaturedBlogPosts({ settings }: SectionProps) {
  const heading = (settings.heading as string) || "From the blog";
  // Themes can pass articles in via page.data (the blogs route ships
  // them on /[domain]/blogs). On other pages, this section needs a
  // merchant-supplied list of links in the schema.
  const articles = (settings._injected_articles as Article[] | undefined) || [];
  if (articles.length === 0) return null;

  return (
    <section className="py-16 px-6 max-w-7xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-semibold text-center mb-10">{heading}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {articles.slice(0, 3).map((a) => (
          <article key={a.handle} className="flex flex-col">
            {a.cover_image && <img src={a.cover_image} alt="" className="aspect-[4/3] w-full object-cover rounded-md" />}
            <h3 className="mt-4 text-lg font-semibold">
              <a href={\`/blogs/articles/\${a.handle}\`} className="hover:underline">{a.title}</a>
            </h3>
            {a.published_at && (
              <p className="text-xs text-gray-500 mt-1">{new Date(a.published_at).toLocaleDateString()}</p>
            )}
            {a.excerpt && <p className="mt-2 text-gray-700">{a.excerpt}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
`,
  schema: {
    type: "featured-blog-posts",
    name: "Featured Blog Posts",
    locales: { ar: { name: "من المدونة" } },
    settings: [
      { type: "text", id: "heading", label: "Heading", default: "From the blog" },
    ],
  },
};
