import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { LIBRARY, findEntry } from "../section-library";

/**
 * `numu-theme add-section <name>` — scaffold a new section.
 *
 * Two modes:
 *   - default            → empty section stub
 *   - --from-library <slug> → copy from the built-in library
 *                              (15+ ready-made sections)
 *
 * In either case the command:
 *   1. Writes src/sections/<PascalCase>.tsx
 *   2. Writes schemas/sections/<slug>.json
 *   3. Updates src/main.tsx to import + dispatch the section
 *      (best-effort regex insert; falls back to a comment hint
 *      when main.tsx structure is unexpected)
 *   4. Appends the section to theme.json's home preset's section
 *      list so it shows up in the customizer immediately
 *
 * `--list` flag prints the library catalog and exits.
 */

export const addSectionCommand = new Command("add-section")
  .description("Scaffold a new section (optionally from the built-in library)")
  .argument("[name]", "Section slug (e.g. 'hero-banner' or 'hero_banner')")
  .option(
    "--from-library <slug>",
    "Copy from the built-in section library (run with --list to see options)",
  )
  .option("--list", "List the built-in section library and exit")
  .option("-d, --dir <directory>", "Theme directory", ".")
  .action(
    async (
      name: string | undefined,
      options: { fromLibrary?: string; list?: boolean; dir: string },
    ) => {
      if (options.list) {
        console.log("Built-in section library:\n");
        for (const entry of LIBRARY) {
          console.log(`  ${entry.slug.padEnd(24)} ${entry.description}`);
        }
        console.log(
          "\nUsage: numu-theme add-section <new-name> --from-library <slug>",
        );
        return;
      }

      if (!name) {
        console.error(
          "Section name is required. Run with --list to see library options.",
        );
        process.exit(1);
      }

      const themeDir = path.resolve(process.cwd(), options.dir);
      if (!fs.existsSync(path.join(themeDir, "theme.json"))) {
        console.error(
          "No theme.json in this directory. Run from a theme project root.",
        );
        process.exit(1);
      }

      // Keep a valid section type as typed — snake_case themes (the scaffold,
      // empire) would otherwise get a different, kebab-cased type.
      const slug = SECTION_TYPE_RE.test(name) ? name : toKebab(name);
      const pascal = toPascal(name);

      let componentSource: string;
      let schemaJson: Record<string, unknown>;

      if (options.fromLibrary) {
        const entry = findEntry(options.fromLibrary);
        if (!entry) {
          console.error(
            `Unknown library slug: '${options.fromLibrary}'. Run --list to see options.`,
          );
          process.exit(1);
        }
        componentSource = entry.component;
        // Clone schema + override its `type` field to the user's
        // chosen slug. Theme dev can rename freely; the library is a
        // starting point, not a runtime tie.
        schemaJson = JSON.parse(JSON.stringify(entry.schema)) as Record<
          string,
          unknown
        >;
        (schemaJson as { type?: string }).type = slug;
      } else {
        componentSource = emptySectionStub(pascal);
        schemaJson = {
          type: slug,
          name: humanize(slug),
          settings: [
            {
              type: "text",
              id: "headline",
              label: "Headline",
              default: humanize(slug),
            },
          ],
        };
      }

      // 1. component — file is named by the slug (not PascalCase) so its
      // basename matches the schema's (`schemas/sections/<slug>.json`). The
      // validator's registry↔schema sync rule compares lowercased basenames,
      // so a `Foo.tsx` + `foo-bar.json` pair would otherwise fail `check`.
      const componentPath = path.join(themeDir, "src/sections", `${slug}.tsx`);
      ensureDirOf(componentPath);
      if (fs.existsSync(componentPath)) {
        console.error(`Already exists: ${componentPath}`);
        process.exit(1);
      }
      fs.writeFileSync(componentPath, componentSource);

      // 2. schema
      const schemaPath = path.join(themeDir, "schemas/sections", `${slug}.json`);
      ensureDirOf(schemaPath);
      fs.writeFileSync(schemaPath, JSON.stringify(schemaJson, null, 2));

      // 3. main.tsx best-effort wire-up
      tryWireMain(themeDir, slug, pascal);

      // 4. add to home preset
      tryAddToHomePreset(themeDir, slug);

      console.log(`✔ Created section '${slug}'.`);
      console.log(`  • src/sections/${slug}.tsx`);
      console.log(`  • schemas/sections/${slug}.json`);
      console.log(
        options.fromLibrary
          ? `\nFrom library: '${options.fromLibrary}'. Edit the files to customize.`
          : "\nEdit the files to add your design + behavior.",
      );
    },
  );

// Copied from @numueg/theme-sdk's validator (not exported there).
const SECTION_TYPE_RE = /^[a-z][a-z0-9_-]*$/;

function toKebab(s: string): string {
  return s
    .replace(/[_\s]+/g, "-")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function toPascal(s: string): string {
  return toKebab(s)
    .split("-")
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join("");
}

function humanize(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

function ensureDirOf(p: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function emptySectionStub(pascal: string): string {
  return `import type { SectionProps } from "@numueg/theme-sdk";

export default function ${pascal}({ settings }: SectionProps) {
  const headline = (settings.headline as string) || "${pascal}";
  return (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold">{headline}</h2>
      </div>
    </section>
  );
}
`;
}

function tryWireMain(themeDir: string, slug: string, pascal: string): void {
  const mainPath = path.join(themeDir, "src/main.tsx");
  if (!fs.existsSync(mainPath)) return;
  const src = fs.readFileSync(mainPath, "utf-8");
  if (src.includes(`./sections/${slug}"`)) return; // already imported

  // Insert import after the last existing import. The file lives at
  // ./sections/<slug> (basename matches the schema); the default export keeps
  // its PascalCase identifier.
  const importLine = `import ${pascal} from "./sections/${slug}";\n`;
  const lines = src.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith("import ")) lastImportIdx = i;
  }
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine.trimEnd());
  } else {
    lines.unshift(importLine.trimEnd());
  }

  // Preferred (standard scaffold): a `SECTION_REGISTRY = { ... }` map keyed by
  // section type. Insert a `"slug": Pascal,` entry right after the opening
  // brace so the section dispatches by type.
  for (let i = 0; i < lines.length; i++) {
    if (/SECTION_REGISTRY[^=]*=\s*\{/.test(lines[i])) {
      const indent = (lines[i].match(/^\s*/)?.[0] ?? "") + "  ";
      lines.splice(i + 1, 0, `${indent}"${slug}": ${pascal},`);
      fs.writeFileSync(mainPath, lines.join("\n"));
      return;
    }
  }

  // Insert dispatch — find an existing `section.type === "hero"`
  // ladder and add a matching branch. If we can't find one we just
  // leave a TODO comment for the dev.
  let inserted = false;
  for (let i = 0; i < lines.length; i++) {
    if (/section\.type\s*===\s*['"]/.test(lines[i])) {
      // Insert a parallel branch right above the first match.
      const indent = lines[i].match(/^\s*/)?.[0] ?? "        ";
      lines.splice(
        i,
        0,
        `${indent}if (section.type === "${slug}") {`,
        `${indent}  return <${pascal} key={sectionId} settings={section.settings} />;`,
        `${indent}}`,
      );
      inserted = true;
      break;
    }
  }
  if (!inserted) {
    lines.push(
      "",
      `// TODO: dispatch the new '${slug}' section type:`,
      `// if (section.type === "${slug}") return <${pascal} settings={section.settings} />;`,
    );
  }
  fs.writeFileSync(mainPath, lines.join("\n"));
}

function tryAddToHomePreset(themeDir: string, slug: string): void {
  const themeJsonPath = path.join(themeDir, "theme.json");
  if (!fs.existsSync(themeJsonPath)) return;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(fs.readFileSync(themeJsonPath, "utf-8"));
  } catch {
    return;
  }
  const presets = (parsed.presets as Record<string, unknown>) || {};
  const templates =
    (presets.templates as Record<string, Record<string, unknown>>) || {};
  const home = templates.home;
  if (!home) return;
  const sections = (home.sections ?? []) as
    | Array<{ type?: string } | null>
    | Record<string, { type?: string } | null>;
  // Don't duplicate if the slug is already placed somewhere.
  const existing = Array.isArray(sections) ? sections : Object.values(sections);
  if (existing.some((s) => s?.type === slug)) return;
  const instance = { type: slug, settings: {} };
  if (Array.isArray(sections)) {
    // Every real theme + the scaffold: array order is render order, no `order` key.
    sections.push(instance);
  } else {
    // Legacy id → instance map: extend `order` only if the preset already has one.
    const newKey = `${slug.replace(/-/g, "_")}_1`;
    sections[newKey] = instance;
    if (Array.isArray(home.order)) home.order.push(newKey);
  }
  home.sections = sections;
  fs.writeFileSync(themeJsonPath, JSON.stringify(parsed, null, 2));
}
