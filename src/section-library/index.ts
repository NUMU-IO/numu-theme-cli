/**
 * Built-in section library — ready-made section templates.
 *
 * Each entry packages:
 *   - `slug`        — what `add-section --from-library <slug>` accepts
 *   - `name`        — human-readable display name
 *   - `description` — one-line summary for `add-section --list`
 *   - `component`   — TSX source (uses @numueg/theme-sdk + Tailwind +
 *                     Arabic-aware variants when relevant)
 *   - `schema`      — JSON section schema with bilingual labels +
 *                     sensible defaults
 *
 * Themes can `add-section --from-library hero-with-cta` and get a
 * working section file + schema + registration in main.tsx. They
 * own the resulting files — the library is a starting point, not a
 * runtime dependency.
 *
 * Keep entries independent: no cross-section imports. Each one is a
 * self-contained snippet a dev can fork.
 */

export interface SectionLibraryEntry {
  slug: string;
  name: string;
  description: string;
  /** Source code for src/sections/<PascalCase>.tsx */
  component: string;
  /** Section schema written to schemas/sections/<slug>.json */
  schema: Record<string, unknown>;
}

import { heroWithCta } from "./entries/hero-with-cta";
import { featuredProducts } from "./entries/featured-products";
import { imageWithText } from "./entries/image-with-text";
import { newsletterSignup } from "./entries/newsletter-signup";
import { multiColumn } from "./entries/multi-column";
import { testimonials } from "./entries/testimonials";
import { faqAccordion } from "./entries/faq-accordion";
import { logoCloud } from "./entries/logo-cloud";
import { collectionList } from "./entries/collection-list";
import { videoEmbed } from "./entries/video-embed";
import { richText } from "./entries/rich-text";
import { announcementBar } from "./entries/announcement-bar";
import { countdownTimer } from "./entries/countdown-timer";
import { featuredBlogPosts } from "./entries/featured-blog-posts";
import { contactMap } from "./entries/contact-map";

export const LIBRARY: SectionLibraryEntry[] = [
  heroWithCta,
  featuredProducts,
  imageWithText,
  newsletterSignup,
  multiColumn,
  testimonials,
  faqAccordion,
  logoCloud,
  collectionList,
  videoEmbed,
  richText,
  announcementBar,
  countdownTimer,
  featuredBlogPosts,
  contactMap,
];

export function findEntry(slug: string): SectionLibraryEntry | undefined {
  return LIBRARY.find((e) => e.slug === slug);
}
