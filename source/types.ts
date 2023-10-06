import { Command } from "commander";

export interface SubCommand<T extends Record<string, unknown>> {
  /**
   * Register the subcommand with the CLI.
   * @returns The subcommand instance configured.
   */
  register(): Promise<Command> | Command;

  /**
   * Execute the subcommand.
   * @param options Options passed to the subcommand.
   * @returns The result of the subcommand.
   */
  execute(options: T): Promise<void> | void;
}
