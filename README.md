# @numueg/theme-cli

> CLI for developing, validating, building, linting, and publishing NUMU storefront themes.

[![npm](https://img.shields.io/npm/v/@numueg/theme-cli.svg)](https://www.npmjs.com/package/@numueg/theme-cli)
[![license](https://img.shields.io/npm/l/@numueg/theme-cli.svg)](./LICENSE)

The `numu-theme` command suite. Scaffold, dev-serve, lint, build, submit, install.

## Install

```bash
npm install -g @numueg/theme-cli
numu-theme --version
```

## Quick start

```bash
numu-theme init my-fashion-theme
cd my-fashion-theme
npm install
numu-theme dev
# → http://localhost:3001/__numu/preview
```

Iterate, then:

```bash
numu-theme lint
numu-theme build
numu-theme login           # one-time
numu-theme submit
```

After admin approval, merchants can install your theme from the NUMU marketplace.

## Commands

```
numu-theme init <name>             Scaffold a fresh theme
numu-theme dev [--watch]           Local dev server with HMR
numu-theme check                   Validate theme.json + schemas + locales
numu-theme lint [--strict]         Static analysis (10 rules)
numu-theme build                   Production build → dist/
numu-theme push                    Upload dist/ to developer sandbox
numu-theme submit                  Submit dist/ for marketplace review
numu-theme install <theme-id>      Install a theme into a test store
numu-theme login                   Marketplace auth
numu-theme status                  Login + active theme + build status
numu-theme doctor                  Diagnose common setup issues
numu-theme add-section <name>      Scaffold a section (--from-library <slug>)
numu-theme add-block <section> <name>
numu-theme pull <theme-id>         Download published theme source
numu-theme delete <theme-id>       Soft-delete a draft / unpublish
```

## Bundled section library (15 entries)

`numu-theme add-section <new-name> --from-library <slug>` clones a production-grade section in. `--list` prints the catalog:

```
hero-with-cta              announcement-bar
featured-products          countdown-timer
image-with-text            featured-blog-posts
newsletter-signup          contact-map
multi-column               collection-list
testimonials               video-embed
faq-accordion              rich-text
logo-cloud
```

## Lint rules (10)

`manifest-required-fields`, `schema-registry-sync`, `locale-parity`, `preset-schema-conformance`, `unused-settings`, `img-missing-alt`, `hardcoded-text`, `inline-color-literal`, `forbidden-script-tag`, `use-app-no-availability-check`.

## Docs

- [CLI Reference](https://numueg.app/docs/cli-plugin/cli-commands)
- [Lint Rules](https://numueg.app/docs/cli-plugin/lint-rules)
- [Section Library](https://numueg.app/docs/cli-plugin/section-library)
- [Theme Dev E2E](https://numueg.app/docs/workflows/theme-dev-e2e)

## Node version

Requires Node 18 or newer.

## License

MIT — see [LICENSE](./LICENSE).
