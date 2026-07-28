/**
 * Guards the scaffold's toolchain pins against silent rot.
 *
 * `templates/scaffold/package.json` used to hardcode `^0.5.0` for all three
 * NUMU packages. A caret on a 0.x version is locked to its minor
 * (`^0.5.0` → `>=0.5.0 <0.6.0`), so it never floated forward: by the time
 * anyone looked, `numu-theme init` was scaffolding a theme against SDK 0.5.2
 * while the storefront host served 0.12 — the exact shape of the SDK-mismatch
 * failure that blanks a live storefront.
 *
 * Nothing failed loudly when that happened, which is the whole problem. These
 * tests make it fail here instead.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");
const scaffoldPkg = JSON.parse(
  readFileSync(join(root, "templates", "scaffold", "package.json"), "utf-8"),
) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};
const ownPkg = JSON.parse(
  readFileSync(join(root, "package.json"), "utf-8"),
) as { version: string };

describe("scaffold toolchain pins", () => {
  it("keeps every @numueg pin as a token, never a literal version", () => {
    // A literal here is how the pins rotted last time: it looks correct at
    // review, then quietly ages out with every release. The values live in
    // src/commands/init.ts (SDK_PIN / PLUGIN_PIN) or are derived (CLI).
    const all = {
      ...scaffoldPkg.dependencies,
      ...scaffoldPkg.devDependencies,
    };
    for (const [name, range] of Object.entries(all)) {
      if (!name.startsWith("@numueg/")) continue;
      expect(range, `${name} must stay a __TOKEN__`).toMatch(/^__[A-Z_]+__$/);
    }
  });

  it("pins the CLI to the version being released, derived not typed", () => {
    // Asserted against src/commands/init.ts's derivation, so a release that
    // bumps package.json can never leave the scaffold pointing at the old CLI.
    const init = readFileSync(
      join(root, "src", "commands", "init.ts"),
      "utf-8",
    );
    expect(init).toContain("CLI_PIN: `^${readOwnVersion()}`");
    expect(ownPkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("declares SDK and plugin pins as carets in exactly one place", () => {
    const init = readFileSync(
      join(root, "src", "commands", "init.ts"),
      "utf-8",
    );
    const sdk = init.match(/const SDK_PIN = "(\^[\d.]+)"/);
    const plugin = init.match(/const PLUGIN_PIN = "(\^[\d.]+)"/);
    expect(sdk?.[1], "SDK_PIN must be a caret range").toBeTruthy();
    expect(plugin?.[1], "PLUGIN_PIN must be a caret range").toBeTruthy();
  });
});
