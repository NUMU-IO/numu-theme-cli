import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";

export const initCommand = new Command("init")
  .description("Scaffold a new NUMU theme project")
  .argument("<name>", "Theme name")
  .option("--template <template>", "Starter template", "basic")
  .action(async (name: string, options: { template: string }) => {
    const dir = path.resolve(process.cwd(), name);
    if (fs.existsSync(dir)) {
      console.error(`Directory "${name}" already exists`);
      process.exit(1);
    }

    console.log(`Creating NUMU theme: ${name}...`);

    // Create directories
    for (const d of ["src/sections", "src/blocks", "schemas/sections", "schemas/blocks", "assets"]) {
      fs.mkdirSync(path.join(dir, d), { recursive: true });
    }

    // theme.json
    fs.writeFileSync(path.join(dir, "theme.json"), JSON.stringify({
      name, version: "1.0.0", author: "", description: `${name} NUMU theme`,
      presets: { home: { sections: { hero_1: { type: "hero", settings: { headline: "Welcome to our store" } } }, order: ["hero_1"] } }
    }, null, 2));

    // settings_schema.json
    fs.writeFileSync(path.join(dir, "settings_schema.json"), JSON.stringify([
      { type: "color", id: "primary_color", label: "Primary Color", default: "#3B82F6" },
      { type: "color", id: "secondary_color", label: "Secondary Color", default: "#1E40AF" },
      { type: "select", id: "font_family", label: "Font Family", default: "Inter", options: [
        { value: "Inter", label: "Inter" }, { value: "Roboto", label: "Roboto" }, { value: "Cairo", label: "Cairo" }
      ]}
    ], null, 2));

    // Sample section
    fs.writeFileSync(path.join(dir, "src/sections/Hero.tsx"), `import { useShop, useThemeSettings } from "@numu/theme-sdk";
import type { SectionProps } from "@numu/theme-sdk";

export default function Hero({ settings }: SectionProps) {
  const shop = useShop();
  return (
    <section className="min-h-[50vh] flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold">{settings.headline || shop.name}</h1>
        {settings.subtitle && <p className="mt-4 text-xl">{settings.subtitle}</p>}
      </div>
    </section>
  );
}
`);

    // Section schema
    fs.writeFileSync(path.join(dir, "schemas/sections/hero.json"), JSON.stringify({
      type: "hero", name: "Hero Banner", name_ar: "بانر رئيسي",
      settings: [
        { type: "text", id: "headline", label: "Headline", label_ar: "العنوان", default: "Welcome" },
        { type: "text", id: "subtitle", label: "Subtitle", label_ar: "العنوان الفرعي" },
        { type: "image_picker", id: "background_image", label: "Background Image", label_ar: "صورة الخلفية" },
      ]
    }, null, 2));

    // package.json
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
      name: `numu-theme-${name}`, version: "1.0.0", private: true,
      scripts: { dev: "numu-theme dev", build: "numu-theme build", check: "numu-theme check" },
      dependencies: { "@numu/theme-sdk": "^0.1.0" },
      devDependencies: { "@numu/theme-cli": "^0.1.0", "vite": "^6.0.0", "typescript": "^5.8.0", "@types/react": "^19.0.0" }
    }, null, 2));

    // .gitignore
    fs.writeFileSync(path.join(dir, ".gitignore"), "node_modules\ndist\n.env\n.env.*\n.next\n");

    console.log(`\nTheme "${name}" created successfully!\n\nNext steps:\n  cd ${name}\n  npm install\n  numu-theme dev\n`);
  });
