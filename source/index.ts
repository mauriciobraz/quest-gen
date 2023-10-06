import { Command } from "commander";

import { QuestGenSubCommand } from "./commands/quest-gen";
import { SubCommand } from "./types";

const SUB_COMMANDS: SubCommand<Record<string, unknown>>[] = [
  new QuestGenSubCommand(),
];

async function registerSubCommands(program: Command) {
  for (const subCommandInfo of SUB_COMMANDS) {
    const subCommand = await subCommandInfo.register();
    program.addCommand(subCommand);
  }
}

async function findSubCommandExecutable(program: Command) {
  const foundCommand = SUB_COMMANDS.find(async (subCommandInfo) =>
    (await subCommandInfo.register()).name(),
  );

  if (!foundCommand) {
    throw new Error("Unknown subcommand");
  }

  return foundCommand;
}

async function main() {
  const program = new Command().version("0.0.1").name("blai");
  await registerSubCommands(program);

  const command = await program.parseAsync(process.argv);

  const subCommand = await findSubCommandExecutable(command);
  await subCommand.execute(command.opts());
}

if (import.meta.main) {
  main();
}
