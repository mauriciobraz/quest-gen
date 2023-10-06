import { Command } from "commander";
import { SubCommand } from "../types";

type SummarizeFolderOptions = {
  directory: string;
  output: string;
  model: string;

  stream: boolean;
  cache: boolean;

  tokens?: string;
  key?: string;
};

export class SummarizeFolder implements SubCommand<SummarizeFolderOptions> {
  register(): Command | Promise<Command> {
    throw new Error("Method not implemented.");
  }

  execute(options: SummarizeFolderOptions): void | Promise<void> {
    throw new Error("Method not implemented.");
  }
}
