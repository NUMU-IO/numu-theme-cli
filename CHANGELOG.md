# Changelog

All notable changes to `@numueg/theme-cli` are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.9.1] - 2026-09-23

### Fixed

- **`numu app init` scaffolds a developer skill that matches the live platform.** The skill it copies into `.claude/skills/numu-app-developer/SKILL.md` used to contradict the API in six places. Its `settings_schema` example used `label: {ar, en}` (the API requires `locales.ar.label`), and its `icon` example was a relative path (the API requires an `https://` URL). It told developers to sign in with `numu login --token <PAT>`, which a scoped personal token cannot use for partner commands. It named an `invalid_grant` error the API never sends, and pointed to `developers.numueg.app` pages and a `$schema` URL that do not exist. It also listed events NUMU does not send. It now follows the published guide at https://docs.numueg.app/-partner-apps-2440012m0.
- **`numu login` on a 2FA account** no longer suggests an API token for `numu app` commands, which do not accept one; it points to the partner portal.

## [0.9.0] - 2026-09-22

### Added

- **`numu app`: build and ship a NUMU Partner App from the terminal** (a new `numu` binary next to `numu-theme`).
  - `init` scaffolds `numu.app.json` and the `numu-app-developer` Claude skill.
  - `validate` checks the manifest against the API's own rules; nothing is stored.
  - `create` registers the app in your partner account and prints the client secret once.
  - `version` uploads the manifest as a draft.
  - `submit` sends it for NUMU review; `status` shows versions, review state and NUMU's notes.
  - `publish` makes the approved version live.
  - `install` puts the app on one of your development stores.
  - `webhook trigger <event>` POSTs a correctly signed (`X-NUMU-Signature-V1`) sample delivery to your endpoint; add `--bad-signature` to check that you reject forgeries.
- **`lint`: `physical-css-direction`** flags `left`/`right`-specific utilities and properties (`ml-`, `pr-`, `left-`, `text-right`, `rounded-l-`, …) so layouts mirror under RTL; use the logical forms (`ms-`, `pe-`, `start-`, `text-start`, `rounded-s-`).
- **`lint`: `no-local-template-helpers`** (error) flags a local definition of `resolveSections` or `selectTemplateSections`, exported or not. That policy decides which sections render and lives in `@numueg/theme-sdk` since 0.12.0; copies kept being vendored into themes after the hoist. A local wrapper that calls the SDK is allowed.

### Changed

- **Scaffold:** new themes pin `@numueg/theme-sdk ^0.16.0` and the cart's coupon box uses the SDK's `useDiscountCode()` instead of hand-rolled apply/remove state (which reported rejected codes wrongly).
- **Scaffold:** `templates/scaffold/src/main.tsx` no longer defines its own `resolveSections`; `selectSections` now wraps the SDK's `selectTemplateSections` and only normalises blocks. Every `numu-theme init` used to create an unexported fork that an export-only check could not see.

### Fixed

- **`add-section`** appends to array-shaped home presets (every real theme and the scaffold) instead of writing a map key that never serialized plus a stray `home.order`. Valid snake_case types (e.g. `product_details`) are kept as typed instead of being kebab-cased, and their display name splits on `_`.
- **`doctor`** checks preset section refs in `presets.templates` and `presets.section_groups`; it previously visited 0 sections and still reported success.
- **`lint`**: `schema-registry-sync` and `preset-schema-conformance` now cover `presets.section_groups` (array or map `sections`), and the orphan-schema warning fires (it was gated on `Object.keys(<Set>)`, always empty).

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
