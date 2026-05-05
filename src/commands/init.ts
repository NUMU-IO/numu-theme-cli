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
 *                               react/react-dom and @numu/theme-sdk
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
      `import type { SectionProps } from "@numu/theme-sdk";

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

    // Theme entry point — exports the theme component the storefront mounts.
    fs.writeFileSync(
      path.join(dir, "src/main.tsx"),
      `import type { ThemeSettingsV3 } from "@numu/theme-sdk";
import Hero from "./sections/Hero";

interface ThemeProps {
  themeSettings: ThemeSettingsV3;
}

export default function Theme({ themeSettings }: ThemeProps) {
  const home = themeSettings.templates?.home;
  return (
    <main>
      {home?.order.map((sectionId) => {
        const section = home.sections[sectionId];
        if (!section || section.disabled) return null;
        if (section.type === "hero") {
          return <Hero key={sectionId} settings={section.settings} />;
        }
        return null;
      })}
    </main>
  );
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
import { numuTheme } from "@numu/theme-plugin";

// The @numu/theme-plugin handles all the NUMU-specific glue:
//   - validates theme.json + settings_schema.json + entry point
//   - externalizes React + @numu/theme-sdk (host-provided)
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
          dependencies: { "@numu/theme-sdk": "^0.1.0" },
          devDependencies: {
            "@numu/theme-cli": "^0.1.0",
            "@numu/theme-plugin": "^0.1.0",
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
