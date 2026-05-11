import { Command } from "commander";
import { initCommand } from "./commands/init";
import { devCommand } from "./commands/dev";
import { checkCommand } from "./commands/check";
import { buildCommand } from "./commands/build";
import { pushCommand } from "./commands/push";
import { submitCommand } from "./commands/submit";
import { installCommand } from "./commands/install";
import { loginCommand } from "./commands/login";
import { statusCommand } from "./commands/status";
import { doctorCommand } from "./commands/doctor";
import { addSectionCommand, addBlockCommand } from "./commands/add-section";

const program = new Command();

program
  .name("numu-theme")
  .description("CLI for developing, validating, building, and publishing NUMU themes")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(devCommand);
program.addCommand(checkCommand);
program.addCommand(buildCommand);
program.addCommand(pushCommand);
program.addCommand(submitCommand);
program.addCommand(installCommand);
program.addCommand(loginCommand);
program.addCommand(statusCommand);
program.addCommand(doctorCommand);
program.addCommand(addSectionCommand);
program.addCommand(addBlockCommand);

program.parse();
