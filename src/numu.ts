import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { appCommand } from "./commands/app";
import { loginCommand } from "./commands/login";

/**
 * `numu` — the NUMU partner CLI (apps plan, Phase 3). Ships in the same
 * package as `numu-theme` and shares its login (`~/.numurc`), so one sign-in
 * covers themes and apps.
 */
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const program = new Command();
program
  .name("numu")
  .description("NUMU partner CLI: build and publish apps for NUMU merchants")
  .version(readVersion());
program.addCommand(loginCommand);
program.addCommand(appCommand);
program.parse();
