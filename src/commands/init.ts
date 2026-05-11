import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";

/**
 * Scaffold a new NUMU theme project. The output is runnable end-to-end:
 *
 *   cd <name>
 *   npm install
 *   npx numu-theme dev      # starts Vite + registers with the configured store
 *   npx numu-theme build    # validates + builds for marketplace upload
 *
 * Files written:
 *   theme.json                — manifest (name, version, presets, etc.)
 *   settings_schema.json      — global theme settings schema
 *   schemas/sections/hero.json — section schema for the example Hero
 *   src/sections/Hero.tsx     — example section
 *   src/main.tsx              — entry point that registers the SDK + exports
 *                               the theme component tree
 *   index.html                — Vite entry
 *   vite.config.ts            — minimal config: ESM lib build, externalize
 *                               react/react-dom and @numueg/theme-sdk
 *   tsconfig.json             — JSX + ESNext modules
 *   package.json              — scripts + deps + matching version
 *   .gitignore
 */
export const initCommand = new Command("init")
  .description("Scaffold a new NUMU theme project")
  .argument("<name>", "Theme name")
  .option("--template <template>", "Starter template", "basic")
  .action(async (name: string, _options: { template: string }) => {
    const dir = path.resolve(process.cwd(), name);
    if (fs.existsSync(dir)) {
      console.error(`Directory "${name}" already exists`);
      process.exit(1);
    }

    console.log(`Creating NUMU theme: ${name}...`);

    for (const d of [
      "src/sections",
      "src/blocks",
      "schemas/sections",
      "schemas/blocks",
      "assets",
    ]) {
      fs.mkdirSync(path.join(dir, d), { recursive: true });
    }

    // theme.json — manifest. The marketplace build pipeline reads this.
    fs.writeFileSync(
      path.join(dir, "theme.json"),
      JSON.stringify(
        {
          id: name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          name,
          author: "",
          version: "0.1.0",
          layout: "single-column",
          description: `${name} NUMU theme`,
          // Phase 7.3 — static BYOT templates for chrome that renders
          // outside the React tree (the streaming loading skeleton +
          // the client error boundary). Themes that want to fully
          // own those moments edit these HTML files; absent or 404
          // → the platform's hardcoded fallback renders.
          error_template: "templates/error.html",
          loading_template: "templates/loading.html",
          presets: {
            templates: {
              home: {
                name: "Home",
                sections: [
                  {
                    type: "hero",
                    settings: { headline: "Welcome to our store" },
                  },
                ],
              },
            },
          },
        },
        null,
        2,
      ),
    );

    // Phase 7.3 — scaffold the static BYOT templates. These ship in
    // the built theme bundle (dist/templates/{error,loading}.html)
    // and are fetched + injected by the storefront's error.tsx and
    // loading.tsx routes when the active theme is BYOT.
    fs.mkdirSync(path.join(dir, "templates"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "templates/error.html"),
      `<!--
  Static BYOT error template — rendered by the storefront when a
  page throws. No JS available (the bundle might be the thing that
  failed). Use <button data-numu-reset> to expose a retry button —
  the storefront wires the click for you.
-->
<main role="alert" style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:system-ui">
  <div style="text-align:center;max-width:28rem">
    <h1 style="font-size:1.5rem;font-weight:700;color:#b91c1c">Something went wrong</h1>
    <p style="color:#374151;margin-top:.5rem">Please try again in a moment.</p>
    <button data-numu-reset type="button" style="margin-top:1.5rem;padding:.5rem 1rem;background:#1d4ed8;color:white;border-radius:.375rem;border:0;cursor:pointer">Try again</button>
  </div>
</main>
`,
    );
    fs.writeFileSync(
      path.join(dir, "templates/loading.html"),
      `<!-- Static BYOT loading skeleton. -->
<div role="status" aria-live="polite" aria-label="Loading" style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:system-ui">
  <div style="display:flex;align-items:center;gap:.75rem;color:#4b5563">
    <svg style="width:1.25rem;height:1.25rem;animation:spin 1s linear infinite" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity=".25" stroke-width="3"></circle>
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path>
    </svg>
    <span style="font-size:.875rem;font-weight:500">Loading…</span>
  </div>
  <style>@keyframes spin { to { transform: rotate(360deg) } }</style>
</div>
`,
    );

    // settings_schema.json
    fs.writeFileSync(
      path.join(dir, "settings_schema.json"),
      JSON.stringify(
        [
          {
            type: "color",
            id: "primary_color",
            label: "Primary Color",
            default: "#3B82F6",
          },
          {
            type: "color",
            id: "secondary_color",
            label: "Secondary Color",
            default: "#1E40AF",
          },
          {
            type: "select",
            id: "font_family",
            label: "Font Family",
            default: "Inter",
            options: [
              { value: "Inter", label: "Inter" },
              { value: "Roboto", label: "Roboto" },
              { value: "Cairo", label: "Cairo" },
            ],
          },
        ],
        null,
        2,
      ),
    );

    // styles.css — minimum requirement for the build pipeline.
    fs.writeFileSync(
      path.join(dir, "styles.css"),
      ":root { --numu-primary: #3B82F6; }\n",
    );

    // Sample section
    fs.writeFileSync(
      path.join(dir, "src/sections/Hero.tsx"),
      `import type { SectionProps } from "@numueg/theme-sdk";

export default function Hero({ settings }: SectionProps) {
  return (
    <section className="min-h-[50vh] flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold">{settings.headline as string || "Welcome"}</h1>
        {settings.subtitle ? (
          <p className="mt-4 text-xl">{settings.subtitle as string}</p>
        ) : null}
      </div>
    </section>
  );
}
`,
    );

    // Section schema
    fs.writeFileSync(
      path.join(dir, "schemas/sections/hero.json"),
      JSON.stringify(
        {
          type: "hero",
          name: "Hero Banner",
          locales: { ar: { name: "بانر رئيسي" } },
          settings: [
            {
              type: "text",
              id: "headline",
              label: "Headline",
              locales: { ar: { label: "العنوان" } },
              default: "Welcome",
            },
            {
              type: "text",
              id: "subtitle",
              label: "Subtitle",
              locales: { ar: { label: "العنوان الفرعي" } },
            },
            {
              type: "image_picker",
              id: "background_image",
              label: "Background Image",
              locales: { ar: { label: "صورة الخلفية" } },
            },
          ],
        },
        null,
        2,
      ),
    );

    // Theme entry point — exports both:
    //
    //   1. default Theme component (used by built-in storefronts that share
    //      React with the bundle via an import map).
    //   2. mount(el, props) — used by BYOT host paths that load the bundle
    //      with its OWN React copy. The bundle owns the render cycle inside
    //      `el` so its hooks (useState/useContext/etc.) find their dispatcher.
    //      Without this you hit "Cannot read properties of null (reading
    //      'useContext')" the moment any SDK hook runs.
    //
    // The mount() also wraps the tree in NuMuProvider + PageContext +
    // Product/CollectionProvider so SDK hooks like useLocalization,
    // useCart, useShop, useProduct all work out of the box. The host
    // passes `page.data.{product,collection,products,collections}` from
    // the route handler.
    fs.writeFileSync(
      path.join(dir, "src/main.tsx"),
      `import { createRoot, type Root } from "react-dom/client";
import type {
  ThemeSettingsV3,
  Page,
  Product,
  Collection,
  Store,
} from "@numueg/theme-sdk";
import {
  usePage,
  PageContext,
  ProductProvider,
  CollectionProvider,
  NuMuProvider,
} from "@numueg/theme-sdk";
import Hero from "./sections/Hero";

interface ThemeProps {
  themeSettings: ThemeSettingsV3;
}

const SECTION_REGISTRY: Record<string, React.ComponentType<any>> = {
  hero: Hero,
};

export default function Theme({ themeSettings }: ThemeProps) {
  const page = usePage();
  const pageType = page?.type || "home";
  const template =
    themeSettings.templates?.[pageType] || themeSettings.templates?.home;

  return (
    <main>
      {template?.order.map((sectionId) => {
        const section = template.sections[sectionId];
        if (!section || section.disabled) return null;
        const Component = SECTION_REGISTRY[section.type];
        if (!Component) return null;
        return (
          <Component
            key={sectionId}
            settings={section.settings}
            blocks={section.blocks}
            blockOrder={section.block_order}
          />
        );
      })}
    </main>
  );
}

// ── BYOT mount helper ──────────────────────────────────────────────────────
// Required by Next.js storefront's <ByotThemeBoundary>. Owns the React
// render cycle for the bundle's subtree so hooks work.

interface MountProps {
  themeSettings: ThemeSettingsV3;
  storeData?: Store;
  page?: Page & { data?: Record<string, unknown> };
}

// Fallback Store used only when host didn't pass storeData. NuMuProvider
// hard-requires Store.currency for Intl.NumberFormat — synthesize one
// instead of crashing.
const FALLBACK_STORE: Store = {
  id: "",
  name: "",
  slug: "",
  currency: "USD",
  default_language: "en",
  use_nextjs_storefront: true,
};

function ThemeWithContext({ themeSettings, storeData, page }: MountProps) {
  // Storefront returns snake_case \`default_currency\` / \`default_language\`
  // but SDK Store expects \`currency\`. Map both shapes so NuMuProvider's
  // Intl.NumberFormat doesn't blow up on an empty currency code.
  const raw = (storeData ?? FALLBACK_STORE) as Record<string, unknown> & Store;
  const store: Store = {
    ...raw,
    currency:
      (raw.currency as string) ||
      (raw.default_currency as string) ||
      FALLBACK_STORE.currency,
    default_language:
      (raw.default_language as string) || FALLBACK_STORE.default_language,
  };

  const product = page?.data?.product as Product | undefined;
  const collection = page?.data?.collection as Collection | undefined;
  const pageValue: Page = page
    ? {
        type: page.type,
        title: page.title || "",
        handle: page.handle,
        data: page.data,
      }
    : { type: "home", title: "" };

  let tree = <Theme themeSettings={themeSettings} />;
  if (collection)
    tree = <CollectionProvider collection={collection}>{tree}</CollectionProvider>;
  if (product)
    tree = <ProductProvider product={product}>{tree}</ProductProvider>;

  return (
    <NuMuProvider store={store} themeSettings={themeSettings} locale={store.default_language}>
      <PageContext.Provider value={pageValue}>{tree}</PageContext.Provider>
    </NuMuProvider>
  );
}

// The host (\`ByotThemeBoundary\`) prefers the object-shape return:
//   { unmount, update }
// When \`update\` is present, the customizer forwards prop-only changes
// (themeSettings / storeData / page) into the SAME React tree without
// re-importing the bundle. Without \`update\`, every settings tweak
// would trigger a full remount — fine, but visibly slower.
export interface MountHandle {
  unmount: () => void;
  update: (next: MountProps) => void;
}

export function mount(el: HTMLElement, props: MountProps): MountHandle {
  const root: Root = createRoot(el);
  let current: MountProps = props;
  root.render(<ThemeWithContext {...current} />);

  // Live preview: the storefront's PreviewBridge forwards customizer edits
  // as \`numu:theme-update\` window events. Re-render with the new payload.
  // Also covered by the \`update\` method below — both paths funnel into
  // the same root.render() so they can't drift.
  function handleUpdate(e: Event) {
    const detail = (e as CustomEvent<ThemeSettingsV3>).detail;
    if (!detail || typeof detail !== "object") return;
    current = { ...current, themeSettings: detail };
    root.render(<ThemeWithContext {...current} />);
  }
  window.addEventListener("numu:theme-update", handleUpdate);

  return {
    unmount: () => {
      window.removeEventListener("numu:theme-update", handleUpdate);
      root.unmount();
    },
    update: (next: MountProps) => {
      current = next;
      root.render(<ThemeWithContext {...current} />);
    },
  };
}
`,
    );

    // index.html — Vite expects this even for library builds when running dev.
    fs.writeFileSync(
      path.join(dir, "index.html"),
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name} — NUMU Theme Dev</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/dev-entry.tsx"></script>
  </body>
</html>
`,
    );

    // Dev-only entry — mounts the theme with a placeholder ThemeSettings
    // for local preview. Not bundled into the marketplace artifact.
    fs.writeFileSync(
      path.join(dir, "src/dev-entry.tsx"),
      `import { createRoot } from "react-dom/client";
import Theme from "./main";

const placeholder = {
  schema_version: 3 as const,
  theme_id: "${name}",
  global_settings: {},
  templates: {
    home: {
      name: "Home",
      sections: { hero_1: { type: "hero", settings: { headline: "Hello, theme!" } } },
      order: ["hero_1"],
    },
  },
  section_groups: {},
};

const root = document.getElementById("root");
if (root) createRoot(root).render(<Theme themeSettings={placeholder as any} />);
`,
    );

    // vite.config.ts
    fs.writeFileSync(
      path.join(dir, "vite.config.ts"),
      `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { numuTheme } from "@numueg/theme-plugin";

// The @numueg/theme-plugin handles all the NUMU-specific glue:
//   - validates theme.json + settings_schema.json + entry point
//   - externalizes React + @numueg/theme-sdk (host-provided)
//   - emits dist/manifest.json + dist/import-map.json after build
//
// You don't need to repeat \`build.lib\` / \`build.rollupOptions.external\`
// — the plugin sets sensible defaults when they're omitted.

export default defineConfig({
  plugins: [react(), numuTheme()],
  server: { port: 5173 },
});
`,
    );

    // tsconfig.json
    fs.writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            lib: ["ES2022", "DOM", "DOM.Iterable"],
            module: "ESNext",
            moduleResolution: "bundler",
            jsx: "react-jsx",
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            isolatedModules: true,
            esModuleInterop: true,
            resolveJsonModule: true,
          },
          include: ["src"],
        },
        null,
        2,
      ),
    );

    // package.json — version is the source of truth for `numu-theme submit`.
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify(
        {
          name: `numu-theme-${name}`,
          version: "0.1.0",
          private: true,
          type: "module",
          scripts: {
            dev: "numu-theme dev",
            build: "numu-theme build",
            check: "numu-theme check",
          },
          dependencies: { "@numueg/theme-sdk": "^0.1.0" },
          devDependencies: {
            "@numueg/theme-cli": "^0.1.0",
            "@numueg/theme-plugin": "^0.1.0",
            "@vitejs/plugin-react": "^4.3.0",
            vite: "^6.0.0",
            typescript: "^5.8.0",
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
            react: "^19.0.0",
            "react-dom": "^19.0.0",
          },
        },
        null,
        2,
      ),
    );

    // .gitignore
    fs.writeFileSync(
      path.join(dir, ".gitignore"),
      "node_modules\ndist\n.env\n.env.*\n.next\n",
    );

    console.log(
      `\nTheme "${name}" created.\n\nNext steps:\n  cd ${name}\n  npm install\n  npx numu-theme dev   # local preview\n  npx numu-theme build # production build\n`,
    );
  });
