/**
 * `numu-theme migrate` — scaffold a V3 theme from a V2 theme directory.
 *
 * The V2 → V3 port is a multi-day exercise per theme (Wave 4 of the
 * customization roadmap). This command handles the deterministic 60%:
 *
 *   - Read the V2 theme path (e.g. numu-egyptian-bazaar/src/themes/empire/)
 *   - Generate a V3 scaffold (theme.json, settings_schema.json, vite.config,
 *     etc.) using the V2 theme's id + name where derivable.
 *   - Copy styles.css verbatim.
 *   - Copy each V2 section .tsx into the new src/sections/ directory and
 *     stamp a "ADAPTER NOTES" block at the top of each file listing the
 *     V2 hooks that need to be swapped for V3 SDK hooks (the
 *     `migrationNotesFor()` helper does the static analysis).
 *   - Emit a stub `src/main.tsx` that registers each section in the
 *     SECTION_REGISTRY map so the bundle builds even with un-ported
 *     sections (those sections render as "UnknownSection" placeholders
 *     until the developer adapts the body).
 *
 * What the command does NOT do (deliberately):
 *
 *   - Rewrite section bodies to use V3 SDK hooks. That's per-section
 *     judgment work (V2 useProducts() → V3 useProducts() has different
 *     loading semantics; useCart() has different return shape; etc.).
 *     The adapter notes call out exactly what to change.
 *   - Build the bundle. Run `npm install && numu-theme build` next.
 *
 * Usage:
 *
 *   numu-theme migrate ../numu-egyptian-bazaar/src/themes/boutique
 *
 * Output goes into `./<v2-id>-engine-V3/` by default; override with
 * `--out`. The directory must not already exist (we don't overwrite).
 */

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";

// ─── Static analysis helpers ────────────────────────────────────────────────

/** Patterns that flag a V2 hook needing a V3 equivalent. */
const V2_HOOK_PATTERNS: Array<{
  pattern: RegExp;
  v2: string;
  v3: string;
  note: string;
}> = [
  {
    pattern: /from\s+["']@\/contexts\/StoreContext["']/,
    v2: "useStore (bazaar)",
    v3: "useShop() from @numueg/theme-sdk",
    note: "Returns Store directly; bazaar's useStore returns { store, themeSettings, ... } — destructure differently.",
  },
  {
    pattern: /useProductsContext|from\s+["']@\/contexts\/ProductsContext["']/,
    v2: "useProductsContext (bazaar)",
    v3: "useProducts() from @numueg/theme-sdk",
    note: "V3 hook is paginated + has loading state. Shape: { items, loading, error, hasMore, loadMore }. V2 returned flat array.",
  },
  {
    pattern: /useCart\s*\(\s*\)/,
    v2: "useCart (bazaar)",
    v3: "useCart() from @numueg/theme-sdk",
    note: "Same name but different shape — SDK returns { cart, addItem, removeItem, ... } with async actions. Bazaar's was sync.",
  },
  {
    pattern: /useAuth\s*\(\s*\)/,
    v2: "useAuth (bazaar)",
    v3: "useCustomer() + useCustomerActions() from @numueg/theme-sdk",
    note: "Customer state is split from action handlers in V3 to avoid render-on-every-action.",
  },
  {
    pattern: /useTheme\s*\(\s*\)|from\s+["']@\/contexts\/ThemeContext["']/,
    v2: "useTheme (bazaar)",
    v3: "useThemeSettings() from @numueg/theme-sdk",
    note: "Returns ThemeSettingsV3; access settings via .global_settings or .templates[<page>].sections[<id>].settings.",
  },
  {
    pattern: /useLanguage\s*\(/,
    v2: "useLanguage (bazaar)",
    v3: "useLocalization() / useDirection() from @numueg/theme-sdk",
    note: "Returns { locale, direction, translations, ... }. Use useTranslation() for resolving message keys.",
  },
  {
    pattern: /editable\.section\s*\(/,
    v2: "editable.section() helper",
    v3: "<EditableText> / <EditableImage> from @numueg/theme-sdk",
    note: "V3 marks editable nodes via dedicated components instead of spread props.",
  },
];

interface MigrationNote {
  v2: string;
  v3: string;
  note: string;
  lineHint?: number;
}

/**
 * Scan a section source file for V2 hooks/imports and return the list
 * of replacements the developer needs to make. Static, line-based — we
 * don't try to be smart about scoped imports or aliases.
 */
function migrationNotesFor(source: string): MigrationNote[] {
  const notes: MigrationNote[] = [];
  const lines = source.split("\n");
  for (const { pattern, v2, v3, note } of V2_HOOK_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        notes.push({ v2, v3, note, lineHint: i + 1 });
        break; // one note per pattern per file
      }
    }
  }
  return notes;
}

/** Build the comment block we stamp at the top of each ported section. */
function adapterCommentBlock(notes: MigrationNote[], v2RelativePath: string): string {
  const lines: string[] = [
    "/**",
    " * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    " *  V3 PORT — ADAPTER NOTES",
    " * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    " *",
    ` *  Source: ${v2RelativePath}`,
    " *",
    " *  Generated by `numu-theme migrate`. Review and rewrite using V3",
    " *  SDK hooks before publishing. The list below was inferred from",
    " *  static analysis — there may be other V2 idioms not detected.",
    " *",
  ];
  if (notes.length === 0) {
    lines.push(" *  No V2-specific hooks detected. You may only need to:");
    lines.push(" *    1. Replace any bazaar-specific imports with @numueg/theme-sdk equivalents.");
    lines.push(" *    2. Wrap your section's root element with <Section id={...} type={...}> from the SDK.");
    lines.push(" *    3. Read settings from `props.instance.settings` (V3 SectionInstance shape).");
  } else {
    lines.push(" *  Required swaps:");
    lines.push(" *");
    for (const n of notes) {
      const where = n.lineHint ? ` (line ${n.lineHint})` : "";
      lines.push(` *    • ${n.v2}${where}`);
      lines.push(` *      → ${n.v3}`);
      lines.push(` *      ${n.note}`);
      lines.push(" *");
    }
  }
  lines.push(" *  When done, remove this block.");
  lines.push(" * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(" */");
  return lines.join("\n");
}

// ─── Filesystem helpers ─────────────────────────────────────────────────────

/** Recursively copy a directory. Skips node_modules / .git / dist. */
function copyDir(src: string, dst: string): void {
  const SKIP = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".cache",
    ".next",
    ".turbo",
  ]);
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

/** Find every .tsx file under `dir`, recursive. Returns absolute paths. */
function findSectionFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findSectionFiles(full));
    else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Convert a V2 section filename → V3 section type. PascalCase → kebab-case. */
function sectionTypeFromFilename(filename: string): string {
  const base = path.basename(filename).replace(/\.(tsx|ts)$/, "");
  return base
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .toLowerCase();
}

// ─── v2-bridge shim ─────────────────────────────────────────────────────────

/**
 * Per-theme bridge module. Lets the ported V2 section files import from
 * a local relative path (`../v2-bridge`) instead of bazaar's
 * non-existent `@/contexts/...` paths.
 *
 * The bridge re-exports V2-shaped APIs backed by the V3 SDK's
 * `@numueg/theme-sdk/v2-compat` subpath. Sections that consumed:
 *
 *   import { useProducts } from "@/contexts/ProductsContext";
 *
 * get rewritten by the post-processor to:
 *
 *   import { useProducts } from "../v2-bridge";
 *
 * and `useProducts()` returns the V2-shaped `{ products, loading }`
 * tuple via `useV2Products()`. Same trick for `useCategories`, the
 * V2 `Link` from react-router-dom (replaced with a plain `<a>` —
 * the host storefront's link interceptor handles navigation), and
 * `SectionComponentProps`.
 *
 * This file is intentionally a *bridge*, not a permanent compat
 * layer. The ADAPTER NOTES at the top of each ported section flag
 * which V2 idioms to rewrite — once a theme is hand-polished, the
 * bridge file becomes unused and can be deleted.
 */
function makeV2Bridge(): string {
  return `/**
 * v2-bridge — per-theme compat shim for V2 sections ported via
 * \`numu-theme migrate\`. DELETE this file once each section has been
 * rewritten to use idiomatic V3 SDK hooks + components.
 */

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import {
  useV2Products,
  useV2Categories,
  useV2Auth,
  useV2Language,
  useV2Theme,
} from "@numueg/theme-sdk/v2-compat";
import { ProductCard, useThemeSettings } from "@numueg/theme-sdk";
import type { SectionInstance } from "@numueg/theme-sdk";

// ── Re-shaped V3 hooks under V2 names ─────────────────────────────────────

/** V2's \`useProducts\` returned \`{ products, loading }\`. Same shape. */
export function useProducts() {
  return useV2Products();
}

/** V2's \`useCategories\` returned \`{ categories, loading }\`. Same shape. */
export function useCategories() {
  return useV2Categories();
}

/** V2's \`useAuth\` returned \`{ user, isAuthenticated }\`. */
export function useAuth() {
  return useV2Auth();
}

/** V2's \`useLanguage\` returned \`{ language, direction, setLanguage, t }\`. */
export function useLanguage() {
  return useV2Language();
}

/** V2's \`useStore\` returned the full store config; here we expose
 *  only the parts ported sections use (themeSettings nested). */
export function useStore() {
  return useV2Theme();
}

// ── V2 type re-shaping ────────────────────────────────────────────────────

/**
 * V2 sections expected this prop shape:
 *
 *   interface SectionComponentProps {
 *     section: { id: string; type: string; settings: Record<string, any>; ... };
 *     ...
 *   }
 *
 * V3 mount passes \`{ instance: SectionInstance }\`. We re-export a
 * compatible interface so existing destructure patterns like
 * \`const { section } = props\` keep compiling — the wrapper below
 * coerces \`instance\` → \`section\` at render time.
 */
export interface SectionComponentProps {
  section: SectionInstance & { id?: string };
}

/**
 * Section adapter. Migrate-generated sections still expect to be
 * called with \`{ section }\`; the V3 \`SECTION_REGISTRY\` calls them
 * with \`{ instance }\`. Wrap each export:
 *
 *   export default v2Section(YourComponent);
 */
export function v2Section<P extends SectionComponentProps>(
  Component: (props: P) => ReactNode,
): (props: { instance: SectionInstance }) => ReactNode {
  return function V2SectionAdapter({ instance }) {
    const props = { section: instance } as unknown as P;
    return Component(props);
  };
}

// ── editable.section() compat ────────────────────────────────────────────

/**
 * V2's editable helper spread DOM props on individual nodes so the
 * old V2 customizer could click-select them. V3 uses \`<EditableText>\`
 * / \`<EditableImage>\` for the same job. Returning an empty object
 * here means the spread is a no-op — the section still renders, just
 * without the inline click-to-edit affordance. Replace with the V3
 * components when polishing the port.
 */
export const editable = {
  section: (_sectionId: string, _key: string) => ({}),
  block: (_blockId: string, _key: string) => ({}),
};

// ── Misc re-exports the V2 sections often imported ────────────────────────

export { ProductCard, useThemeSettings };

/**
 * V2's \`<Link to="/...">\` came from react-router-dom. The V3 storefront
 * is Next.js, where \`<a href="/...">\` works (Next intercepts internal
 * navigation). We expose a polyfill so existing JSX renders without
 * react-router-dom installed. Pass-through any extra props.
 */
export function Link({
  to,
  children,
  ...rest
}: { to: string; children: ReactNode } & Omit<
  ComponentPropsWithoutRef<"a">,
  "href"
>) {
  return (
    <a href={to} {...rest}>
      {children}
    </a>
  );
}

/** V2's image placeholder constant. */
export const PLACEHOLDER_HERO =
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=60";
`;
}

/**
 * Mechanically rewrite a ported section file's imports so the V2 paths
 * resolve to the local v2-bridge shim. Returns the rewritten source.
 *
 * The rewrites are conservative — we only touch known V2 import paths.
 * Anything else (react-router-dom, framer-motion, lucide-react, etc.)
 * is left as-is so the section developer sees what extra deps still
 * need to be installed.
 */
function rewriteV2Imports(source: string): string {
  // Map V2 import path → v2-bridge re-export. The path is exactly what
  // appears between the import statement's quotes.
  const PATH_REWRITES: Array<[RegExp, string]> = [
    // The most-common bazaar context imports.
    [/@\/contexts\/ProductsContext/g, "../v2-bridge"],
    [/@\/contexts\/AuthContext/g, "../v2-bridge"],
    [/@\/contexts\/LanguageContext/g, "../v2-bridge"],
    [/@\/contexts\/StoreContext/g, "../v2-bridge"],
    [/@\/contexts\/ThemeContext/g, "../v2-bridge"],
    // V2 engine types + editable helper.
    [/@\/themes\/engine\/types/g, "../v2-bridge"],
    [/@\/themes\/engine\/editable/g, "../v2-bridge"],
    // bazaar's shared ProductCard component.
    [/@\/components\/store\/ProductCard/g, "../v2-bridge"],
    // The image placeholder constant.
    [/@\/lib\/imagePlaceholders/g, "../v2-bridge"],
    // react-router-dom → bridge (Link polyfill). Only the named
    // imports we know about; the bridge exports `Link`. Sections that
    // need other react-router-dom APIs will fail at build time, which
    // is the right outcome — they need manual conversion.
    [/(['"])react-router-dom\1/g, '"../v2-bridge"'],
  ];

  let out = source;
  for (const [pattern, replacement] of PATH_REWRITES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

// ─── Skeleton files ─────────────────────────────────────────────────────────

function makeThemeJson(themeId: string, displayName: string, sectionTypes: string[]) {
  return {
    id: themeId,
    name: displayName,
    author: "",
    version: "0.1.0",
    layout: "single-column",
    description: `${displayName} — migrated from V2.`,
    error_template: "templates/error.html",
    loading_template: "templates/loading.html",
    presets: {
      templates: {
        home: {
          name: "Home",
          sections: sectionTypes.map((type) => ({
            type,
            settings: {},
          })),
        },
      },
    },
  };
}

function makeSettingsSchema() {
  return [
    {
      name: "Brand",
      settings: [
        {
          type: "color",
          id: "primary_color",
          label: "Primary color",
          default: "#111111",
        },
        {
          type: "color",
          id: "accent_color",
          label: "Accent color",
          default: "#d4af37",
        },
      ],
    },
  ];
}

function makeMainTsx(themeId: string, displayName: string, sectionTypes: string[]): string {
  const registryEntries = sectionTypes
    .map((type) => `  "${type}": lazy(() => import("./sections/${type}")),`)
    .join("\n");
  return `/**
 * ${displayName} (V3) — entry point.
 *
 * Generated by \`numu-theme migrate\`. Section components live in
 * src/sections/<type>.tsx and are lazy-loaded so only sections the
 * merchant actually uses pay the bundle cost.
 */

import {
  StrictMode,
  lazy,
  Suspense,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  NuMuProvider,
  Section,
  useThemeSettings,
  type ThemeSettingsV3,
  type Store,
  type Cart,
  type Customer,
  type SectionInstance,
  type MountResult,
} from "@numueg/theme-sdk";
import themeManifest from "../theme.json";

const SECTION_REGISTRY: Record<string, ReturnType<typeof lazy>> = {
${registryEntries}
};

function UnknownSection({ type }: { type: string }) {
  return (
    <section style={{ padding: "1rem", border: "1px dashed #fb923c" }}>
      Unknown section: <strong>{type}</strong>
    </section>
  );
}

interface ResolvedSection {
  id: string;
  instance: SectionInstance;
}

interface MaybeOrdered {
  sections?: Record<string, SectionInstance> | SectionInstance[];
  order?: string[];
}

function resolveSections(group: MaybeOrdered | undefined): ResolvedSection[] {
  if (!group) return [];
  if (Array.isArray(group.sections)) {
    return group.sections.map((instance, idx) => ({
      id: \`\${instance.type}-\${idx}\`,
      instance,
    }));
  }
  const map = (group.sections ?? {}) as Record<string, SectionInstance>;
  const order = group.order ?? Object.keys(map);
  return order
    .map((id): ResolvedSection | null => {
      const instance = map[id];
      if (!instance) return null;
      return { id, instance };
    })
    .filter((x): x is ResolvedSection => Boolean(x));
}

const BUILTIN_HOME = (themeManifest as unknown as { presets?: { templates?: { home?: MaybeOrdered } } })
  .presets?.templates?.home;

function RenderSection({
  instance,
  sectionId,
  groupId,
}: {
  instance: SectionInstance;
  sectionId: string;
  groupId?: string;
}) {
  const Component = SECTION_REGISTRY[instance.type];
  if (!Component) {
    return (
      <Section id={sectionId} type={instance.type} groupId={groupId}>
        <UnknownSection type={instance.type} />
      </Section>
    );
  }
  return (
    <Section id={sectionId} type={instance.type} groupId={groupId}>
      <Suspense fallback={<div style={{ minHeight: "20vh" }} />}>
        <Component instance={instance} />
      </Suspense>
    </Section>
  );
}

function ThemeApp() {
  const settings = useThemeSettings();
  const hostHome = settings.templates?.home as MaybeOrdered | undefined;
  const sections = resolveSections(hostHome ?? BUILTIN_HOME);
  return (
    <div data-${themeId}-app>
      {sections.map(({ id, instance }) => (
        <RenderSection key={id} sectionId={id} instance={instance} />
      ))}
    </div>
  );
}

// ── Host contract: mount(el, ctx) returns a MountResult ────────────────────

export interface MountContext {
  store: Store;
  themeSettings: ThemeSettingsV3;
  initialCart?: Cart;
  customer?: Customer | null;
  locale?: string;
  translations?: Record<string, string>;
  [extra: string]: unknown;
}

interface DraftHandle {
  applyDraft: (next: ThemeSettingsV3) => void;
}

const ThemeSettingsBridge = forwardRef<DraftHandle, { ctx: MountContext }>(
  function ThemeSettingsBridge({ ctx }, ref) {
    const [themeSettings, setThemeSettings] = useState<ThemeSettingsV3>(
      ctx.themeSettings,
    );
    useImperativeHandle(
      ref,
      () => ({
        applyDraft: (next) => setThemeSettings((prev) => (prev === next ? prev : next)),
      }),
      [],
    );
    return (
      <NuMuProvider
        store={ctx.store}
        themeSettings={themeSettings}
        initialCart={ctx.initialCart}
        customer={ctx.customer}
        locale={ctx.locale}
        translations={ctx.translations}
      >
        <ThemeApp />
      </NuMuProvider>
    );
  },
);

let currentRoot: Root | null = null;

export function mount(el: HTMLElement, ctx: MountContext): MountResult {
  if (currentRoot) {
    currentRoot.unmount();
    currentRoot = null;
  }
  const root = createRoot(el);
  currentRoot = root;
  const handleRef = { current: null as DraftHandle | null };
  root.render(
    <StrictMode>
      <ThemeSettingsBridge
        ctx={ctx}
        ref={(h) => {
          handleRef.current = h;
        }}
      />
    </StrictMode>,
  );
  return {
    applyDraft: (next) => handleRef.current?.applyDraft(next),
    cleanup: () => {
      root.unmount();
      if (currentRoot === root) currentRoot = null;
      handleRef.current = null;
    },
  };
}

const v3Handle = {
  kind: "v3-mount" as const,
  numu_theme_version: 3 as const,
  mount_returns: "MountResult" as const,
  manifest: { id: "${themeId}", name: "${displayName}", version: "0.1.0" },
  mount,
};
export default v3Handle;
`;
}

function makeViteConfig(): string {
  return `import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { numuTheme } from "@numueg/theme-plugin";

export default defineConfig({
  plugins: [react(), numuTheme({ federate: false }) as unknown as PluginOption],
  server: { port: 5173 },
});
`;
}

function makePackageJson(themeId: string, displayName: string): object {
  return {
    name: themeId,
    version: "0.1.0",
    private: true,
    description: `${displayName} (V3 port)`,
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview --port 5173",
    },
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      "@numueg/theme-sdk": "^0.1.0",
      // V2 sections commonly import these — including them in deps so
      // `npm install` works without manual edits. The bundle externalises
      // react/react-dom/@numueg/theme-sdk via federation; framer-motion
      // and lucide-react ship as part of the theme bundle (~30-40 KB
      // gzip combined). Themes that prove they don't need them can
      // remove these after polishing.
      "framer-motion": "^11.11.0",
      "lucide-react": "^0.454.0",
    },
    devDependencies: {
      "@numueg/theme-plugin": "^0.1.0",
      "@types/react": "^18.3.0",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.0",
      typescript: "^5.5.0",
      vite: "^6.0.0",
    },
  };
}

function makeTsConfig(): object {
  return {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      strict: true,
      noImplicitAny: true,
      strictNullChecks: true,
      esModuleInterop: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      isolatedModules: true,
      allowSyntheticDefaultImports: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ["src", "theme.json"],
  };
}

function makeIndexHtml(displayName: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${displayName} — dev preview</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

function makeTemplates(): { error: string; loading: string } {
  return {
    error: `<!-- Static BYOT error template -->
<main role="alert" style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:system-ui">
  <div style="text-align:center;max-width:28rem">
    <h1 style="font-size:1.5rem;font-weight:700;color:#b91c1c">Something went wrong</h1>
    <p style="color:#374151;margin-top:.5rem">Please try again in a moment.</p>
    <button data-numu-reset type="button" style="margin-top:1.5rem;padding:.5rem 1rem;background:#1d4ed8;color:white;border-radius:.375rem;border:0;cursor:pointer">Try again</button>
  </div>
</main>
`,
    loading: `<!-- Static BYOT loading skeleton -->
<div role="status" aria-live="polite" aria-label="Loading" style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:system-ui">
  <span style="font-size:.875rem;font-weight:500;color:#4b5563">Loading…</span>
</div>
`,
  };
}

// ─── Command ────────────────────────────────────────────────────────────────

export const migrateCommand = new Command("migrate")
  .description("Scaffold a V3 theme project from a V2 theme directory")
  .argument(
    "<v2-path>",
    "Path to the V2 theme directory (e.g. ../numu-egyptian-bazaar/src/themes/empire)",
  )
  .option(
    "--out <dir>",
    "Output directory (default: ./<v2-id>-engine-V3)",
  )
  .option(
    "--name <displayName>",
    "Override the display name (default: title-cased v2 id)",
  )
  .action(
    async (
      v2Path: string,
      options: { out?: string; name?: string },
    ) => {
      const absV2Path = path.resolve(process.cwd(), v2Path);
      if (!fs.existsSync(absV2Path) || !fs.statSync(absV2Path).isDirectory()) {
        console.error(chalk.red(`V2 path does not exist or is not a directory: ${absV2Path}`));
        process.exit(1);
      }

      const v2Id = path.basename(absV2Path).toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const themeId = `${v2Id}-v3`;
      const displayName =
        options.name ?? v2Id.charAt(0).toUpperCase() + v2Id.slice(1).replace(/-/g, " ") + " (V3)";

      const outDir = path.resolve(
        process.cwd(),
        options.out ?? `${v2Id}-engine-V3`,
      );
      if (fs.existsSync(outDir)) {
        console.error(chalk.red(`Output directory already exists: ${outDir}`));
        console.error(chalk.dim("Remove it first, or pass --out to a fresh location."));
        process.exit(1);
      }

      console.log(chalk.bold(`\nMigrating V2 → V3:`));
      console.log(`  ${chalk.dim("from")} ${absV2Path}`);
      console.log(`  ${chalk.dim("  to")} ${outDir}\n`);

      // 1. Layout the output directory.
      for (const d of [
        "src/sections",
        "src/v2-bridge",
        "schemas/sections",
        "schemas/blocks",
        "templates",
      ]) {
        fs.mkdirSync(path.join(outDir, d), { recursive: true });
      }

      // 1b. Drop the v2-bridge shim so the ported sections' rewritten
      // imports resolve. The file is a one-shot — once each section
      // has been polished to use idiomatic V3 hooks, the bridge can
      // be deleted along with the import.
      fs.writeFileSync(
        path.join(outDir, "src/v2-bridge", "index.tsx"),
        makeV2Bridge(),
      );

      // 2. Copy styles.css if present.
      const v2Styles = path.join(absV2Path, "styles.css");
      if (fs.existsSync(v2Styles)) {
        fs.copyFileSync(v2Styles, path.join(outDir, "styles.css"));
        console.log(chalk.green("  ✓ Copied styles.css"));
      } else {
        fs.writeFileSync(
          path.join(outDir, "styles.css"),
          `/* ${displayName} styles */\n`,
        );
        console.log(chalk.yellow("  ⚠ No styles.css found — created an empty one"));
      }

      // 3. Inventory V2 sections.
      const v2SectionsDir = path.join(absV2Path, "sections");
      const sectionFiles = fs.existsSync(v2SectionsDir)
        ? findSectionFiles(v2SectionsDir)
        : [];

      const sectionTypes: string[] = [];
      const allNotes: Array<{ file: string; type: string; notes: MigrationNote[] }> = [];

      for (const file of sectionFiles) {
        // Skip nested .module.css companions etc.
        if (!file.endsWith(".tsx")) continue;
        const type = sectionTypeFromFilename(file);
        sectionTypes.push(type);
        const v2Source = fs.readFileSync(file, "utf-8");
        const notes = migrationNotesFor(v2Source);
        allNotes.push({ file, type, notes });

        const relativeV2 = path.relative(process.cwd(), file);
        const header = adapterCommentBlock(notes, relativeV2);
        // Auto-rewrite the most-common V2 import paths to point at the
        // local v2-bridge shim so the ported file at least compiles
        // against the V3 SDK. Manual polish still wanted (the bridge
        // is a "renders, doesn't ship" shape), but typecheck + build
        // both pass without per-section hand-editing.
        const rewritten = rewriteV2Imports(v2Source);
        const ported = `${header}\n\n${rewritten}`;
        fs.writeFileSync(
          path.join(outDir, "src/sections", `${type}.tsx`),
          ported,
        );

        // Emit a minimal schema stub.
        fs.writeFileSync(
          path.join(outDir, "schemas/sections", `${type}.json`),
          JSON.stringify(
            {
              type,
              name: type
                .split("-")
                .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                .join(" "),
              settings: [],
            },
            null,
            2,
          ),
        );
      }
      console.log(chalk.green(`  ✓ Ported ${sectionTypes.length} section file(s)`));

      // 4. Write the static V3 scaffold files.
      fs.writeFileSync(
        path.join(outDir, "theme.json"),
        JSON.stringify(makeThemeJson(themeId, displayName, sectionTypes), null, 2),
      );
      fs.writeFileSync(
        path.join(outDir, "settings_schema.json"),
        JSON.stringify(makeSettingsSchema(), null, 2),
      );
      fs.writeFileSync(
        path.join(outDir, "src/main.tsx"),
        makeMainTsx(themeId, displayName, sectionTypes),
      );
      fs.writeFileSync(
        path.join(outDir, "vite.config.ts"),
        makeViteConfig(),
      );
      fs.writeFileSync(
        path.join(outDir, "package.json"),
        JSON.stringify(makePackageJson(themeId, displayName), null, 2),
      );
      fs.writeFileSync(
        path.join(outDir, "tsconfig.json"),
        JSON.stringify(makeTsConfig(), null, 2),
      );
      fs.writeFileSync(
        path.join(outDir, "index.html"),
        makeIndexHtml(displayName),
      );

      const tpl = makeTemplates();
      fs.writeFileSync(path.join(outDir, "templates/error.html"), tpl.error);
      fs.writeFileSync(path.join(outDir, "templates/loading.html"), tpl.loading);
      fs.writeFileSync(
        path.join(outDir, ".gitignore"),
        "node_modules/\ndist/\n.DS_Store\n",
      );

      console.log(chalk.green("  ✓ Wrote scaffold files\n"));

      // 5. Print the migration report.
      const filesWithNotes = allNotes.filter((n) => n.notes.length > 0);
      if (filesWithNotes.length > 0) {
        console.log(chalk.bold.yellow("Sections that need manual review:"));
        for (const { type, notes } of filesWithNotes) {
          console.log(
            `\n  ${chalk.cyan(type)} ${chalk.dim(`(${notes.length} V2 hooks to swap)`)}`,
          );
          for (const n of notes) {
            console.log(
              `    • ${chalk.dim(`L${n.lineHint ?? "?"}`)} ${n.v2} → ${chalk.green(n.v3)}`,
            );
          }
        }
        console.log();
      }

      console.log(chalk.bold("\nNext steps:"));
      console.log(`  ${chalk.cyan("cd")} ${path.relative(process.cwd(), outDir)}`);
      console.log(`  ${chalk.cyan("npm install")}`);
      console.log(`  ${chalk.cyan("npm run dev")}                ${chalk.dim("# dev preview on :5173")}`);
      console.log(`  ${chalk.cyan("npx numu-theme build")}       ${chalk.dim("# validate + build")}`);
      console.log(
        `\n${chalk.dim("Open each src/sections/*.tsx and follow the ADAPTER NOTES at the top.")}`,
      );
    },
  );
