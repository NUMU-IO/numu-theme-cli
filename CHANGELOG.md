# Changelog

All notable changes to `@numueg/theme-cli` are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
