/**
 * `add-section` against the preset shape every real theme and both scaffolds
 * use: `presets.templates.home.sections` is an ARRAY. The command used to
 * assign a map key onto that array (JSON.stringify drops it) and write a
 * stray `home.order`, so the new section never reached the home preset while
 * the CLI still printed success.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { addSectionCommand } from "../commands/add-section";

const dirs: string[] = [];

function themeWithArrayPreset(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "numu-add-section-"));
  dirs.push(dir);
  fs.writeFileSync(
    path.join(dir, "theme.json"),
    JSON.stringify({
      name: "t",
      version: "0.1.0",
      presets: { templates: { home: { sections: [{ type: "hero", settings: {} }] } } },
    }),
  );
  return dir;
}

async function addSection(dir: string, name: string): Promise<void> {
  vi.spyOn(console, "log").mockImplementation(() => {});
  await addSectionCommand.parseAsync([name, "-d", dir], { from: "user" });
}

function home(dir: string): { sections: Array<{ type: string }>; order?: unknown } {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "theme.json"), "utf-8"));
  return manifest.presets.templates.home;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe("add-section", () => {
  it("appends to an array home preset, dedupes by type, and never writes order", async () => {
    const dir = themeWithArrayPreset();
    await addSection(dir, "hero-banner");
    await addSection(dir, "hero"); // already placed — must not duplicate

    const h = home(dir);
    expect(h.sections.map((s) => s.type)).toEqual(["hero", "hero-banner"]);
    expect(h).not.toHaveProperty("order");
  });

  it("keeps a valid snake_case type as typed and only kebab-cases invalid input", async () => {
    const dir = themeWithArrayPreset();
    await addSection(dir, "product_details");
    await addSection(dir, "PromoStrip");

    const schema = JSON.parse(
      fs.readFileSync(path.join(dir, "schemas/sections/product_details.json"), "utf-8"),
    );
    expect(schema.type).toBe("product_details");
    expect(schema.name).toBe("Product Details");
    expect(fs.existsSync(path.join(dir, "src/sections/product_details.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "schemas/sections/promo-strip.json"))).toBe(true);
    expect(home(dir).sections.map((s) => s.type)).toEqual([
      "hero",
      "product_details",
      "promo-strip",
    ]);
  });
});
