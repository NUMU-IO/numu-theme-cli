# Changelog

All notable changes to `@numueg/theme-cli` are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] - 2026-06-26

### Changed

- **`numu-theme init` now scaffolds the "NUMU Starter"** — a complete, premium, production-shaped theme instead of a single Hero stub. Every new theme inherits the platform standards by default:
  - Bilingual (AR/EN) section copy via an inline `useT()` helper (`src/lib/i18n`).
  - Money coerced with `Number()` and images resolved defensively (`src/lib/format`) so string-priced API rows never concatenate.
  - Inline field editing through `<EditableText>`; the entry forwards each section's id so the customizer can wire edits.
  - Brand resolves to the live store name (the placeholder is treated as unset), multi-currency + a language switcher in the header, and an always-on footer ticker.
  - A size-aware product page: sizes from the product's size chart render as required pickers that gate add-to-cart, plus an embedded "frequently bought together" bundle.
  - Header/footer section groups + home/product/products/cart/search templates, a full `styles.css`, and the robust registry-based `src/main.tsx` (group + template rendering with preset fallback).
- Scaffold template files now ship in the package (`templates/scaffold`) and are copied + token-substituted at init time (no more giant embedded strings).

### Added

- **Section library**: `product-details` (size-chart-aware PDP that gates add-to-cart on a size pick), `frequently-bought` (related-product bundle with one-tap add-all), and `size-guide` (size-chart trigger + modal). Existing entries are now bilingual via the same `useT()` standard.

### Fixed

- **`add-section`** now wires sections into the registry-based `main.tsx` (`SECTION_REGISTRY`), and writes the component file with a slug-based name so its basename matches the schema — multi-word library slugs (e.g. `featured-products`) no longer fail `numu-theme check`.
- Library entries `featured-products` / `collection-list` updated for the current SDK (`useProducts`/`useCollections` no longer accept `ids` — filter client-side), and `multi-column` now renders blocks via the correct `{id → instance}` map + `<Block id type>` contract.

## [0.1.0] - 2026-05-11

First public release. Full surface documented at [numueg.app/docs/cli-plugin/overview](https://numueg.app/docs/cli-plugin/overview).

### Added

- **`numu-theme init <name>`** — scaffold a fresh theme (entry, sections, blocks, schemas, locales, templates, assets).
- **`numu-theme dev`** — local Vite dev server with HMR + mock-data preview at `http://localhost:3001/__numu/preview`.
- **`numu-theme check`** — syntax-validate `theme.json` + every schema + locale.
- **`numu-theme lint`** — static analysis runner with 10 built-in rules:
  - `manifest-required-fields`
  - `schema-registry-sync`
  - `locale-parity`
  - `preset-schema-conformance`
  - `unused-settings`
  - `img-missing-alt`
  - `hardcoded-text`
  - `inline-color-literal`
  - `forbidden-script-tag`
  - `use-app-no-availability-check`
- **`numu-theme build`** — production Vite build with contract validation + schema codegen.
- **`numu-theme push`** — upload `dist/` to the developer sandbox.
- **`numu-theme submit`** — submit `dist/` for public marketplace review.
- **`numu-theme install <theme-id>`** — install a published or developer-uploaded theme into a test store.
- **`numu-theme login` / `status` / `doctor`** — auth + diagnostics.
- **`numu-theme add-section <name>`** — scaffold a section, with `--from-library <slug>` to copy from the bundled 15-entry section library:
  - hero-with-cta, featured-products, image-with-text, newsletter-signup, multi-column, testimonials, faq-accordion, logo-cloud, collection-list, video-embed, rich-text, announcement-bar, countdown-timer, featured-blog-posts, contact-map.
- **`numu-theme add-block <section> <name>`** — scaffold a block under a section.
- **`numu-theme pull` / `delete`** — download published theme source / soft-delete a draft.
