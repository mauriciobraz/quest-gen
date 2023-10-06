import fs from "fs/promises";
import os from "os";

import { createHash } from "crypto";
import { resolve } from "path";

import ora, { Ora } from "ora";
import chalk, { ChalkInstance } from "chalk";

import { glob } from "glob";
import { Command, program } from "commander";

import { OpenAI } from "langchain/llms/openai";
import { Document } from "langchain/document";

import { DirectoryLoader } from "langchain/document_loaders/fs/directory";

import { CSVLoader } from "langchain/document_loaders/fs/csv";
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { EPubLoader } from "langchain/document_loaders/fs/epub";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import {
  JSONLinesLoader,
  JSONLoader,
} from "langchain/document_loaders/fs/json";

import type { SubCommand } from "../types";

type QuestGenOptions = {
  directory: string;
  questions: string;
  output: string;
  model: string;

  stream: boolean;
  cache: boolean;

  tokens?: string;
  key?: string;
};

export class QuestGenSubCommand implements SubCommand<QuestGenOptions> {
  /**
   * Variables
   * - `{document}`: The document to analyze.
   * - `{numQuestions}`: The number of questions to generate.
   */
  private PROMPT_TEMPLATE =
    'Expert Question Generator, style of Gladwell & Pink. Analyze: "{document}", generate {numQuestions} diverse, comprehensive questions, adjustable complexity, for students to professionals. Skip with a single \n. No answers.';

  register(): Command {
    return new Command("quest-gen")
      .option(
        "-d, --directory <directory>",
        "Specify the directory where the documents to be processed are located. Default is './data'.",
      )
      .option(
        "-o, --output <output>",
        "Specify the file path where the generated questions should be written. Default is './questions.json'.",
      )
      .option(
        "-k, --key <key>",
        'Specify the OpenAI API key. If not provided, it will default to the value of the "OPENAI_API_KEY" environment variable.',
      )
      .option(
        "-m, --model <model>",
        "Specify the OpenAI model to use for question generation. If not provided, it will default to 'gpt-3.5-turbo' or the value of the OPENAI_MODEL environment variable.",
      )
      .option(
        "-q, --questions <questions>",
        "Specify the number of questions to generate per document. Default is '25'.",
      )
      .option(
        "-s, --stream",
        "If set, questions will be streamed as they are generated. This feature is not yet supported.",
        false,
      )
      .option(
        "-t, --tokens <tokens>",
        "Specify the maximum number of tokens to generate per question. This can be used to limit the length of generated questions.",
      )
      .option(
        "-c, --cache",
        "If set, the cache will be disabled. This will cause the documents to be reloaded and pre-processed every time the program is run.",
        true,
      );
  }

  async execute(options: QuestGenOptions): Promise<void> {
    const spinner = ora({
      text: 'Starting "Questions Generator"',
    });

    const REQUIRED_OPTIONS = ["directory", "output"];

    if (process.env.OPENAI_API_KEY === undefined) {
      REQUIRED_OPTIONS.push("key");
    }

    for (const option of REQUIRED_OPTIONS) {
      if (!options[option as keyof typeof options]) {
        program.error(
          `Missing required option: ${option}. See --help for more information.`,
        );
      }
    }

    if (options.stream) {
      program.error(
        "Streaming is not yet supported, please disable the --stream option.",
      );
    }

    const questionsPerDocument = parseInt(options.questions, 10);

    spinner.start();

    const openai = new OpenAI({
      modelName: options.model,
      openAIApiKey: options.key || process.env.OPENAI_API_KEY,
      maxTokens: options.tokens ? parseInt(options.tokens, 10) : undefined,
    });

    const documents = await this.loadDocuments(
      options.directory,
      options,
      spinner,
    );

    const questions: string[][] = [];

    await Promise.all(
      documents.map(async (document, index) => {
        spinner.text = `[${index}/${documents.length}] Generating questions`;

        const generatedQuestions = await this.generateQuestions(
          document,
          openai,
          questionsPerDocument,
        );

        questions.push(generatedQuestions);

        spinner.text = `[${index}/${documents.length}] Generated ${generatedQuestions.length} questions`;

        // Rewrite the output file with the new questions.
        // TODO: Stream the questions as they are generated.
        await fs.writeFile(options.output, JSON.stringify(questions, null, 2));
      }),
    );

    spinner.succeed(
      `Generated ${questions.flat().length} questions for ${
        documents.length
      } documents in "${options.output}".`,
    );
  }

  /**
   * Removes repeated newlines from a string and trims it to remove leading and trailing whitespace.
   * @param documents Documents to pre-process before sending to OpenAI.
   * @returns Pre-processed documents.
   */
  private async preProcessDocuments(
    documents: Document<Record<string, any>>[],
  ) {
    return documents.map((document): typeof document => ({
      ...document,
      pageContent: document.pageContent.replace(/\n{2,}/g, "\n").trim(),
    }));
  }

  /**
   * Saves data to a temporary file for caching.
   * @param id Unique ID for the document.
   * @param data Data to cache.
   */
  private cacheTMP(id: string, data: Buffer) {
    return fs.writeFile(resolve(os.tmpdir(), `QG_${id}.bin`), data);
  }

  /**
   * Reads cached data from a temporary file (@see {@link hash}).
   * @param id Unique ID for the document.
   * @returns Cached data.
   */
  private readTMP(id: string) {
    return fs.readFile(resolve(os.tmpdir(), `QG_${id}.bin`));
  }

  /**
   * Hashes a string using MD5.
   * @param input String to hash.
   * @returns Hash of the input string.
   */
  private hash(input: string) {
    return createHash("md5").update(input).digest("hex");
  }

  /**
   * Gets the hash of a directory by hashing the modification time of each file in the directory.
   * @param path Path to the directory to hash.
   * @returns Hash of the directory.
   */
  private async getDirectoryHash(path: string) {
    const files = await glob(resolve(path, "**/*"), {
      cwd: path,
      nodir: true,
    });

    const fileInfos = await Promise.all(
      files.map(
        async (file) =>
          `${file}:${(await fs.stat(resolve(path, file))).mtimeMs}`,
      ),
    );

    return this.hash(fileInfos.join(","));
  }

  /**
   * Loads documents from a directory and pre-processes them with {@link preProcessDocuments}.
   * @param path Path to the directory containing the documents.
   * @returns Documents loaded from the directory.
   */
  private async loadDocuments(
    path: string,
    options: QuestGenOptions,
    spinner: Ora,
  ) {
    const loader = new DirectoryLoader(path, {
      ".pdf": (path) => new PDFLoader(path),
      ".txt": (path) => new TextLoader(path),
      ".docx": (path) => new DocxLoader(path),
      ".epub": (path) => new EPubLoader(path),
      ".csv": (path) => new CSVLoader(path, "text"),
      ".json": (path) => new JSONLoader(path, "/texts"),
      ".jsonl": (path) => new JSONLinesLoader(path, "/html"),
    });

    if (!options.cache) {
      return (await loader.load().then(this.preProcessDocuments)) as Document[];
    }

    const pathHash = await this.getDirectoryHash(path);

    try {
      const cachedData = await this.readTMP(pathHash);

      spinner.text = `[${pathHash}] Cache hit, skipping document loading and pre-processing.`;

      return JSON.parse(cachedData.toString()) as Document[];
    } catch (error) {}

    spinner.text = `[${pathHash}] Loading documents from ${path} and pre-processing.`;

    const processedDocuments = await loader
      .load()
      .then(this.preProcessDocuments);

    await this.cacheTMP(
      pathHash,
      Buffer.from(JSON.stringify(processedDocuments)),
    );

    spinner.text = `[${pathHash}] Cached ${processedDocuments.length} documents from ${path}.`;

    return processedDocuments as Document[];
  }

  /**
   * Generates questions for a document using the OpenAI API.
   * @param document Document to generate questions for.
   * @param openai Instance of the OpenAI API client.
   * @returns Questions generated for the document.
   */
  private async generateQuestions(
    document: Document,
    openai: OpenAI,
    questionsPerDocument: number,
  ) {
    const prompt = this.PROMPT_TEMPLATE.replace(
      "{document}",
      document.pageContent,
    ).replace("{questions}", questionsPerDocument.toString());

    const generatedQuestions = (await openai.call(prompt))
      .split("\n")
      .map((question) =>
        question
          .trim()
          .replace(/\n{2,}/g, "\n")
          .replace(/^\d+\.\s+/, ""),
      );

    return generatedQuestions.filter((question) => question.length > 0);
  }
}

type LogType = "INFO" | "WARN" | "ERROR";

const LOG_COLORS: Record<LogType, ChalkInstance> = {
  WARN: chalk.yellow,
  INFO: chalk.green,
  ERROR: chalk.red,
};

const LOG_PREFIXES: Record<LogType, string> = {
  WARN: "⚠",
  INFO: "ℹ",
  ERROR: "✖",
};

/**
 * Logs a message to the console.
 * @param message Message to log.
 * @param type Type of message to log.
 */
function log(message: string, type: "INFO" | "WARN" | "ERROR" = "INFO") {
  console.log(LOG_COLORS[type](`${LOG_PREFIXES[type]} ${message}`));
}
