import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";

/**
 * `numu-theme add-block <section> <name>` — scaffold a new block inside
 * an existing section schema.
 *
 * Blocks are typically rendered inline by the section, so we don't
 * generate a separate React file — just append a block definition to
 * the JSON schema and remind the dev to wire it.
 *
 * This used to live alongside addSectionCommand in add-section.ts; it
 * moved here when the library-aware add-section grew large enough to
 * deserve its own file.
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
      `\n\x1b[32m✓\x1b[0m Added block "${blockSnake}" to section "${sectionSnake}":`,
      `\n  - ${path.relative(themeDir, schemaPath)}`,
      `\n\n\x1b[33m⚠\x1b[0m The section component should iterate \`blockOrder\` and render each block by type.`,
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
