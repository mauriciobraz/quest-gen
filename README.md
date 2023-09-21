# Questions Generator

Questions Generator is a tool that uses OpenAI's language model to generate insightful questions from given documents. It supports a variety of file formats such as PDF, text, DOCX, EPUB, CSV, JSON, and JSONL. It allows users to specify the number of questions per document and the maximum number of tokens per question. The generated questions are saved in a JSON file.

## Prerequisites

To run this tool, you need to have Node.js and npm installed on your machine.

## Installation

Install the necessary dependencies by running:

- [Bun](https://bun.sh/docs/installation)

```bash
$ bun add commander glob langchain chalk pdf-parse ora
```

## Usage

You can use the following command line options to customize the tool's behavior:

```
-d, --directory <directory>      Specify the directory where the documents to be processed are located. Default is './data'.
-o, --output <output>            Specify the file path where the generated questions should be written. Default is './questions.json'.
-k, --key <key>                  Specify the OpenAI API key. If not provided, it will default to the value of the "OPENAI_API_KEY" environment variable.
-m, --model <model>              Specify the OpenAI model to use for question generation. If not provided, it will default to 'gpt-3.5-turbo' or the value of the OPENAI_MODEL environment variable.
-q, --questions <questions>      Specify the number of questions to generate per document. Default is '25'.
-s, --stream                     If set, questions will be streamed as they are generated. This feature is not yet supported.
-t, --tokens <tokens>            Specify the maximum number of tokens to generate per question. This can be used to limit the length of generated questions.
-c, --cache                      If set, the cache will be disabled. This will cause the documents to be reloaded and pre-processed every time the program is run.
```

To run the tool, use the following command:

```bash
$ bun start -d ./data -o ./questions.json -k YOUR_OPENAI_API_KEY -m gpt-3.5-turbo -q 25 -t 500
```
