import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { initCommand } from "./commands/init";
import { devCommand } from "./commands/dev";
import { checkCommand } from "./commands/check";
import { lintCommand } from "./commands/lint";
import { buildCommand } from "./commands/build";
import { verifyCommand } from "./commands/verify";
import { pushCommand } from "./commands/push";
import { submitCommand } from "./commands/submit";
import { installCommand } from "./commands/install";
import { loginCommand } from "./commands/login";
import { statusCommand } from "./commands/status";
import { doctorCommand } from "./commands/doctor";
import { addSectionCommand } from "./commands/add-section";
import { addBlockCommand } from "./commands/add-block";
import { pullCommand } from "./commands/pull";
import { deleteCommand } from "./commands/delete";
import { migrateCommand } from "./commands/migrate";

/**
 * CLI version — read from package.json at runtime rather than hardcoded, so
 * `numu-theme --version` can never drift from the published version (it was
 * pinned at "0.1.0" while the package shipped 0.6.0). `__dirname` is the
 * `dist/` folder at runtime (tsup emits CJS); package.json sits one level up
 * both in the repo and in the installed package. Falls back to "0.0.0" if it
 * can't be read (should never happen in a real install).
 */
function readVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
    );
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const program = new Command();

program
  .name("numu-theme")
  .description("CLI for developing, validating, building, and publishing NUMU themes")
  .version(readVersion());

program.addCommand(initCommand);
program.addCommand(devCommand);
program.addCommand(checkCommand);
program.addCommand(lintCommand);
program.addCommand(buildCommand);
program.addCommand(verifyCommand);
program.addCommand(pushCommand);
program.addCommand(submitCommand);
program.addCommand(installCommand);
program.addCommand(loginCommand);
program.addCommand(statusCommand);
program.addCommand(doctorCommand);
program.addCommand(addSectionCommand);
program.addCommand(addBlockCommand);
program.addCommand(pullCommand);
program.addCommand(deleteCommand);
program.addCommand(migrateCommand);

program.parse();
