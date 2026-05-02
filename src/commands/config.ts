import type { Command } from "commander";
import {
  initializeConfig,
  getConfigAsString,
  getDefaultCommitTypes,
  updateAiConfig,
} from "../config.js";
import { getErrorMessage } from "../utils.js";
import inquirer from "inquirer";
import chalk from "chalk";
import boxen from "boxen";

const PROVIDER_DEFAULTS: Record<string, { model: string; envVar: string; keyLink: string }> = {
  gemini: {
    model: "gemini-1.5-flash",
    envVar: "GEMINI_API_KEY",
    keyLink: "https://aistudio.google.com/app/apikey",
  },
  openai: {
    model: "gpt-4o-mini",
    envVar: "OPENAI_API_KEY",
    keyLink: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    model: "claude-3-5-haiku-20241022",
    envVar: "ANTHROPIC_API_KEY",
    keyLink: "https://console.anthropic.com/settings/keys",
  },
  groq: {
    model: "llama-3.1-8b-instant",
    envVar: "GROQ_API_KEY",
    keyLink: "https://console.groq.com/keys",
  },
  deepseek: {
    model: "deepseek-chat",
    envVar: "DEEPSEEK_API_KEY",
    keyLink: "https://platform.deepseek.com/api_keys",
  },
  ollama: { model: "llama3.2", envVar: "", keyLink: "" },
  custom: { model: "", envVar: "AI_API_KEY", keyLink: "" },
};

export function registerConfigCommands(program: Command): void {
  const configCommand = program
    .command("config")
    .description("Manage GitClean configuration");

  configCommand
    .command("init")
    .description("Initialize .gitclean.config.json with default settings")
    .option("-g, --global", "Create global config in home directory instead of project directory")
    .action((options) => {
      try {
        const isGlobal = options.global || false;
        initializeConfig(isGlobal);

        const configLocation = isGlobal
          ? "~/.gitclean.config.json (global config)"
          : ".gitclean.config.json (project config)";

        console.log(
          boxen(
            chalk.green("Configuration file created successfully!\n\n") +
            chalk.dim(`${configLocation} created\n`) +
            chalk.dim(
              isGlobal
                ? "This config will be used across all projects\n"
                : "This config will override global settings for this project\n"
            ) +
            chalk.dim("You can now customize commit types and other settings\n\n") +
            chalk.blue("Default commit types:\n") +
            getDefaultCommitTypes()
              .map((type) => chalk.dim(`  • ${type.value} - ${type.description}`))
              .join("\n"),
            {
              padding: 0.5,
              margin: 0.5,
              borderColor: "green",
              borderStyle: "round",
              title: "Config Initialized",
              titleAlignment: "center",
            }
          )
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes("already exists")) {
          const configPath = error.message.split("at ")[1];
          console.log(
            boxen(
              chalk.yellow("Configuration file already exists\n\n") +
              chalk.dim(`Config is already present at:\n${configPath}\n\n`) +
              chalk.dim('Use "gitclean config show" to view current settings'),
              {
                padding: 0.5,
                margin: 0.5,
                borderColor: "yellow",
                borderStyle: "round",
                title: "Config Exists",
                titleAlignment: "center",
              }
            )
          );
        } else {
          console.error(chalk.red("Failed to create config:"), getErrorMessage(error));
          process.exit(1);
        }
      }
    });

  configCommand
    .command("show")
    .description("Display current configuration")
    .action(() => {
      try {
        const configString = getConfigAsString();
        console.log(
          boxen(
            chalk.cyan("Current Configuration:\n\n") + chalk.dim(configString),
            {
              padding: 0.5,
              margin: 0.5,
              borderColor: "cyan",
              borderStyle: "round",
              title: "GitClean Config",
              titleAlignment: "center",
            }
          )
        );
      } catch (error) {
        console.error(chalk.red("Failed to read config:"), getErrorMessage(error));
        process.exit(1);
      }
    });

  configCommand
    .command("ai")
    .description("Interactively configure AI provider, model, and API key")
    .option("-g, --global", "Save to global config (~/.gitclean.config.json) instead of project config")
    .action(async (options) => {
      console.log(
        boxen(
          chalk.cyan("AI Configuration Setup\n\n") +
          chalk.dim("This will update the ") +
          chalk.bold(options.global ? "~/.gitclean.config.json" : ".gitclean.config.json") +
          chalk.dim(" file.\n") +
          chalk.dim("API keys can also be set as environment variables instead."),
          {
            padding: 0.5,
            margin: 0.5,
            borderColor: "cyan",
            borderStyle: "round",
            title: "GitClean AI Setup",
            titleAlignment: "center",
          }
        )
      );

      try {
        const { provider } = await inquirer.prompt([
          {
            name: "provider",
            type: "list",
            message: "Which AI provider would you like to use?",
            choices: [
              { name: `${chalk.yellow("Gemini")}    ${chalk.dim("(Google — gemini-1.5-flash)")}`, value: "gemini" },
              { name: `${chalk.green("OpenAI")}    ${chalk.dim("(gpt-4o-mini)")}`, value: "openai" },
              { name: `${chalk.magenta("Anthropic")} ${chalk.dim("(claude-3-5-haiku)")}`, value: "anthropic" },
              { name: `${chalk.cyan("Groq")}      ${chalk.dim("(fast + free tier — llama)")}`, value: "groq" },
              { name: `${chalk.blue("DeepSeek")}  ${chalk.dim("(deepseek-chat)")}`, value: "deepseek" },
              { name: `${chalk.white("Ollama")}    ${chalk.dim("(local — no API key needed)")}`, value: "ollama" },
              { name: `${chalk.dim("Custom")}    ${chalk.dim("(any OpenAI-compatible endpoint)")}`, value: "custom" },
            ],
          },
        ]);

        const defaults = PROVIDER_DEFAULTS[provider];

        const { model } = await inquirer.prompt([
          {
            name: "model",
            type: "input",
            message: "Model name:",
            default: defaults.model || undefined,
          },
        ]);

        let baseURL: string | undefined;
        if (provider === "custom") {
          const { url } = await inquirer.prompt([
            {
              name: "url",
              type: "input",
              message: "Base URL for your API endpoint:",
              default: "http://localhost:1234/v1",
            },
          ]);
          baseURL = url.trim() || undefined;
        }

        let apiKey: string | undefined;
        let keyStoredAs = "";

        if (provider !== "ollama") {
          const { keyMethod } = await inquirer.prompt([
            {
              name: "keyMethod",
              type: "list",
              message: "How would you like to provide your API key?",
              choices: [
                {
                  name: `${chalk.green("Save in config file")}  ${chalk.dim("(easy, but don't commit the file)")}`,
                  value: "config",
                },
                {
                  name: `${chalk.blue("Set as environment variable")}  ${chalk.dim(`(${defaults.envVar})`)}`,
                  value: "env",
                },
              ],
            },
          ]);

          if (keyMethod === "config") {
            const { key } = await inquirer.prompt([
              {
                name: "key",
                type: "password",
                message: `Enter your ${provider} API key:`,
                mask: "*",
                validate: (v: string) => v.trim().length > 0 || "API key cannot be empty",
              },
            ]);
            apiKey = key.trim();
            keyStoredAs = "config";
          } else {
            keyStoredAs = "env";
          }
        }

        const savedPath = updateAiConfig(
          { provider: provider as any, model: model.trim() || undefined, apiKey, baseURL },
          options.global || false
        );

        const lines: string[] = [
          chalk.green("AI configuration saved!\n"),
          chalk.dim(`File: ${savedPath}\n`),
          `  Provider : ${chalk.cyan(provider)}`,
          `  Model    : ${chalk.cyan(model || defaults.model)}`,
        ];

        if (baseURL) lines.push(`  Base URL : ${chalk.cyan(baseURL)}`);

        if (provider === "ollama") {
          lines.push(`\n${chalk.yellow("Make sure Ollama is running:")} ${chalk.bold("ollama serve")}`);
        } else if (keyStoredAs === "env") {
          lines.push(`\n${chalk.yellow("Set your API key as an environment variable:")}`);
          lines.push(chalk.bold(`  export ${defaults.envVar}=your_key_here`));
          if (defaults.keyLink) lines.push(chalk.dim(`  Get a key: ${defaults.keyLink}`));
        } else if (keyStoredAs === "config") {
          lines.push(`\n${chalk.red("Security reminder:")}`);
          lines.push(chalk.dim("  Add .gitclean.config.json to .gitignore if it contains your API key,"));
          lines.push(chalk.dim("  or use a global config (gitclean config ai --global) to keep it out of the repo."));
        }

        lines.push(`\n${chalk.dim("Test it with:")} ${chalk.bold("gitclean ai")}`);

        console.log(
          boxen(lines.join("\n"), {
            padding: 0.5,
            margin: 0.5,
            borderColor: "green",
            borderStyle: "round",
            title: "AI Setup Complete",
            titleAlignment: "center",
          })
        );
      } catch (error) {
        console.error(chalk.red("AI config setup failed:"), getErrorMessage(error));
        process.exit(1);
      }
    });
}
