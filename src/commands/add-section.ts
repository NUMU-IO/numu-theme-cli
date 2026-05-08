import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";

/**
 * `numu-theme add-section <name>` — scaffold a new section.
 *
 * Writes the four files theme devs would otherwise create by hand:
 *   1. src/sections/<snake_name>.tsx — React component using <Section>
 *      wrapper from @numu/theme-sdk so the customizer click-to-select
 *      works.
 *   2. schemas/sections/<snake_name>.json — settings + locales schema.
 *   3. Reminder line printed to stdout asking the dev to register the
 *      section in src/main.tsx's SECTION_REGISTRY (we don't auto-edit
 *      because every theme structures main.tsx slightly differently).
 *
 * Naming: the input <name> is normalized to snake_case so the file
 * lives at `<snake>.tsx` and the schema at `<snake>.json` — that's the
 * convention the validator expects (lowercased filename matches schema
 * filename verbatim).
 */
export const addSectionCommand = new Command("add-section")
  .description("Scaffold a new section (component + schema)")
  .argument("<name>", "Section name, e.g. 'image_with_text' or 'TestimonialGrid'")
  .option("-d, --dir <directory>", "Theme directory", ".")
  .action((name: string, options: { dir: string }) => {
    const themeDir = path.resolve(options.dir);

    // Sanity check that we're inside a theme.
    if (!fs.existsSync(path.join(themeDir, "theme.json"))) {
      console.error(
        `No theme.json in ${themeDir}. Run inside a theme directory.`,
      );
      process.exit(1);
    }

    const snake = toSnakeCase(name);
    const pascal = toPascalCase(name);
    const sectionsDir = path.join(themeDir, "src", "sections");
    const schemasDir = path.join(themeDir, "schemas", "sections");
    fs.mkdirSync(sectionsDir, { recursive: true });
    fs.mkdirSync(schemasDir, { recursive: true });

    const componentPath = path.join(sectionsDir, `${snake}.tsx`);
    const schemaPath = path.join(schemasDir, `${snake}.json`);

    if (fs.existsSync(componentPath)) {
      console.error(`Already exists: ${path.relative(themeDir, componentPath)}`);
      process.exit(1);
    }
    if (fs.existsSync(schemaPath)) {
      console.error(`Already exists: ${path.relative(themeDir, schemaPath)}`);
      process.exit(1);
    }

    // ── Component ──
    const component = `import { Section, type SectionProps } from "@numu/theme-sdk";

interface ${pascal}Settings {
  headline?: string;
  subtitle?: string;
}

export default function ${pascal}({ settings }: SectionProps & { id: string }) {
  const s = settings as ${pascal}Settings;
  return (
    <Section id={(settings as { __id?: string }).__id ?? "${snake}"} type="${snake}">
      <div className="${snake}">
        <h2>{s.headline || "${humanize(pascal)}"}</h2>
        {s.subtitle && <p>{s.subtitle}</p>}
      </div>
    </Section>
  );
}
`;
    fs.writeFileSync(componentPath, component);

    // ── Schema ──
    const schema = {
      type: snake,
      name: humanize(pascal),
      locales: { ar: { name: humanize(pascal) } },
      settings: [
        {
          type: "text",
          id: "headline",
          label: "Headline",
          default: humanize(pascal),
          locales: { ar: { label: "العنوان" } },
        },
        {
          type: "textarea",
          id: "subtitle",
          label: "Subtitle",
          locales: { ar: { label: "العنوان الفرعي" } },
        },
      ],
    };
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2) + "\n");

    console.log(
      `\n[32m✓[0m Created section "${snake}":`,
      `\n  - ${path.relative(themeDir, componentPath)}`,
      `\n  - ${path.relative(themeDir, schemaPath)}`,
      `\n\n[33m⚠[0m Remember to register it in src/main.tsx:`,
      `\n    import ${pascal} from "./sections/${snake}";`,
      `\n    const SECTION_REGISTRY = { ..., ${snake}: ${pascal} };`,
      `\n\n  And add a preset entry to theme.json's templates if desired.\n`,
    );
  });

/**
 * `numu-theme add-block <section> <name>` — scaffold a block schema
 * inside an existing section's schema file. Block components themselves
 * are typically rendered inline by the section, so we don't generate a
 * separate React file — just append a block definition to the JSON
 * schema and remind the dev to wire it.
 */
export const addBlockCommand = new Command("add-block")
  .description("Scaffold a new block inside an existing section schema")
  .argument("<section>", "Section type, e.g. 'product_grid'")
  .argument("<name>", "Block type, e.g. 'feature'")
  .option("-d, --dir <directory>", "Theme directory", ".")
  .action((section: string, name: string, options: { dir: string }) => {
    const themeDir = path.resolve(options.dir);
    if (!fs.existsSync(path.join(themeDir, "theme.json"))) {
      console.error(`No theme.json in ${themeDir}.`);
      process.exit(1);
    }

    const sectionSnake = toSnakeCase(section);
    const blockSnake = toSnakeCase(name);
    const blockHuman = humanize(toPascalCase(name));
    const schemaPath = path.join(
      themeDir,
      "schemas",
      "sections",
      `${sectionSnake}.json`,
    );
    if (!fs.existsSync(schemaPath)) {
      console.error(
        `Section schema not found: schemas/sections/${sectionSnake}.json`,
      );
      console.error(`Create the section first with \`numu-theme add-section ${sectionSnake}\`.`);
      process.exit(1);
    }

    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8")) as {
      blocks?: unknown[];
      max_blocks?: number;
    };
    schema.blocks = schema.blocks ?? [];
    if (
      Array.isArray(schema.blocks) &&
      schema.blocks.some(
        (b) =>
          typeof b === "object" && b !== null && (b as { type?: string }).type === blockSnake,
      )
    ) {
      console.error(`Block "${blockSnake}" already exists in this section.`);
      process.exit(1);
    }
    schema.blocks.push({
      type: blockSnake,
      name: blockHuman,
      locales: { ar: { name: blockHuman } },
      settings: [
        {
          type: "text",
          id: "label",
          label: "Label",
          default: blockHuman,
          locales: { ar: { label: "النص" } },
        },
      ],
    });
    if (typeof schema.max_blocks !== "number") {
      schema.max_blocks = 12;
    }
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2) + "\n");

    console.log(
      `\n[32m✓[0m Added block "${blockSnake}" to section "${sectionSnake}":`,
      `\n  - ${path.relative(themeDir, schemaPath)}`,
      `\n\n[33m⚠[0m The section component should iterate \`blockOrder\` and render each block by type.`,
      `\n   Pattern:`,
      `\n     {(blockOrder ?? []).map((id) => {`,
      `\n       const b = blocks?.[id];`,
      `\n       if (!b || b.disabled) return null;`,
      `\n       if (b.type === "${blockSnake}") return <Block key={id} id={id} type="${blockSnake}">…</Block>;`,
      `\n       return null;`,
      `\n     })}\n`,
    );
  });

// ── helpers ──────────────────────────────────────────────────────────

function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

function toPascalCase(name: string): string {
  return name
    .replace(/[_\s-]+(.)?/g, (_m, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (m) => m.toUpperCase());
}

function humanize(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (m) => m.toUpperCase());
}
