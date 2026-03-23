#!/usr/bin/env node

import { Command } from "commander";
import { showBanner } from "./banner.js";
import { promptCommit } from "./prompt.js";
import {
  setupGitHook,
  removeGitHook,
  getGitStatus,
  executeFullGitWorkflow,
} from "./git-integration.js";
import inquirer from "inquirer";
import { GitCleanSpellChecker } from "./spellcheck.js";
import {
  initializeConfig,
  getConfigAsString,
  getDefaultCommitTypes,
  updateAiConfig,
} from "./config.js";
import { AiGenerator } from "./ai-generator.js";
import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";
import { createRequire } from "module";
import * as readline from "readline";

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

const program = new Command();

program
  .name("gitclean")
  .description("Clean, conventional commits made easy")
  .version(version, "-v, --version", "Show version information");

program
  .command("setup")
  .alias("install")
  .description("Install GitClean git hooks")
  .action(async () => {
    try {
      await setupGitHook();
      console.log(chalk.green("GitClean hooks installed successfully!"));
    } catch (error) {
      console.error(
        chalk.red("Failed to install hooks:"),
        getErrorMessage(error)
      );
      process.exit(1);
    }
  });

program
  .command("uninstall")
  .alias("remove")
  .description("Remove GitClean git hooks")
  .action(async () => {
    try {
      await removeGitHook();
      console.log(chalk.green("GitClean hooks removed successfully!"));
    } catch (error) {
      console.error(
        chalk.red("Failed to remove hooks:"),
        getErrorMessage(error)
      );
      process.exit(1);
    }
  });

program
  .command("commit")
  .description("Create a conventional commit interactively")
  .option("--hook <file>", "Hook mode: write to commit message file")
  .action(async (options) => {
    showBanner();
    await promptCommit(options.hook);
  });

program
  .command("status")
  .alias("s")
  .description("Show git status")
  .action(() => {
    const status = getGitStatus();
    if (status.trim()) {
      console.log(chalk.blue("Git Status:"));
      console.log(status);
    } else {
      console.log(chalk.green("Working directory clean"));
    }
  });

// Config management commands
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
          chalk.dim(
            "You can now customize commit types and other settings\n\n"
          ) +
          chalk.blue("Default commit types:\n") +
          getDefaultCommitTypes()
            .map((type) =>
              chalk.dim(`  • ${type.value} - ${type.description}`)
            )
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
        console.error(
          chalk.red("Failed to create config:"),
          getErrorMessage(error)
        );
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
      console.error(
        chalk.red("Failed to read config:"),
        getErrorMessage(error)
      );
      process.exit(1);
    }
  });

const PROVIDER_DEFAULTS: Record<string, { model: string; envVar: string; keyLink: string }> = {
  gemini:    { model: "gemini-1.5-flash",         envVar: "GEMINI_API_KEY",    keyLink: "https://aistudio.google.com/app/apikey" },
  openai:    { model: "gpt-4o-mini",              envVar: "OPENAI_API_KEY",    keyLink: "https://platform.openai.com/api-keys" },
  anthropic: { model: "claude-3-5-haiku-20241022",envVar: "ANTHROPIC_API_KEY", keyLink: "https://console.anthropic.com/settings/keys" },
  groq:      { model: "llama-3.1-8b-instant",     envVar: "GROQ_API_KEY",      keyLink: "https://console.groq.com/keys" },
  deepseek:  { model: "deepseek-chat",            envVar: "DEEPSEEK_API_KEY",  keyLink: "https://platform.deepseek.com/api_keys" },
  ollama:    { model: "llama3.2",                 envVar: "",                  keyLink: "" },
  custom:    { model: "",                         envVar: "AI_API_KEY",        keyLink: "" },
};

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
      // Step 1 — choose provider
      const { provider } = await inquirer.prompt([
        {
          name: "provider",
          type: "list",
          message: "Which AI provider would you like to use?",
          choices: [
            { name: `${chalk.yellow("◆")}  Gemini       ${chalk.dim("(Google — gemini-1.5-flash)")}`,        value: "gemini" },
            { name: `${chalk.green("◆")}  OpenAI       ${chalk.dim("(gpt-4o-mini)")}`,                       value: "openai" },
            { name: `${chalk.magenta("◆")}  Anthropic    ${chalk.dim("(claude-3-5-haiku)")}`,                value: "anthropic" },
            { name: `${chalk.cyan("◆")}  Groq         ${chalk.dim("(fast + free tier — llama)")}`,           value: "groq" },
            { name: `${chalk.blue("◆")}  DeepSeek     ${chalk.dim("(deepseek-chat)")}`,                      value: "deepseek" },
            { name: `${chalk.white("◆")}  Ollama       ${chalk.dim("(local — no API key needed)")}`,         value: "ollama" },
            { name: `${chalk.dim("◆")}  Custom       ${chalk.dim("(any OpenAI-compatible endpoint)")}`,      value: "custom" },
          ],
        },
      ]);

      const defaults = PROVIDER_DEFAULTS[provider];

      // Step 2 — choose model
      const { model } = await inquirer.prompt([
        {
          name: "model",
          type: "input",
          message: "Model name:",
          default: defaults.model || undefined,
        },
      ]);

      // Step 3 — baseURL for custom/ollama
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

      // Step 4 — API key (skip for Ollama)
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
                name: `${chalk.green("●")}  Save in config file  ${chalk.dim("(easy, but don't commit the file)")}`,
                value: "config",
              },
              {
                name: `${chalk.blue("●")}  I'll set it as an environment variable  ${chalk.dim(`(${defaults.envVar})`)}`,
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

      // Save to config
      const savedPath = updateAiConfig(
        { provider: provider as any, model: model.trim() || undefined, apiKey, baseURL },
        options.global || false
      );

      // Show result
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
        lines.push(`\n${chalk.red("⚠  Security reminder:")}`);
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

program
  .command("spellcheck")
  .alias("spell")
  .description("Test spell checker with custom text")
  .argument("[text]", "Text to spell check")
  .option("-vr, --verbose", "Show detailed spell checker information")
  .action(async (text, options) => {
    await GitCleanSpellChecker.initialize();

    if (options.verbose) {
      const stats = GitCleanSpellChecker.getSpellCheckStats();
      console.log(
        boxen(
          chalk.blue("Spell Checker Information\n\n") +
          chalk.dim(`Initialized: ${stats.isInitialized ? "Yes" : "No"}\n`) +
          chalk.dim(
            `Dictionary: ${stats.hasDictionary ? "Loaded" : "Fallback mode"}\n`
          ) +
          chalk.dim(`Technical words: ${stats.technicalWordsCount}\n`) +
          chalk.dim(`Typo correction rules: ${stats.typoRulesCount}\n\n`) +
          chalk.yellow("This spell checker is optimized for:\n") +
          chalk.dim("• Git commit messages\n") +
          chalk.dim("• Programming terminology\n") +
          chalk.dim("• Common development terms\n") +
          chalk.dim("• Technical abbreviations"),
          {
            padding: 0.5,
            margin: 0.5,
            borderColor: "blue",
            borderStyle: "round",
            title: "Spell Checker Status",
            titleAlignment: "center",
          }
        )
      );
    }

    if (!text) {
      console.log(
        chalk.yellow(
          'Tip: Provide text to check: gitclean spellcheck "your text here"'
        )
      );
      return;
    }

    console.log(chalk.blue("\nChecking spelling...\n"));

    try {
      const results = await GitCleanSpellChecker.checkSpelling(text);

      if (results.length === 0) {
        console.log(
          boxen(
            chalk.green("No spelling issues found!\n\n") +
            chalk.dim(`Checked text: "${text}"`),
            {
              padding: 0.5,
              margin: 0.5,
              borderColor: "green",
              borderStyle: "round",
              title: "Spell Check Results",
              titleAlignment: "center",
            }
          )
        );
      } else {
        const textWithUnderlines = GitCleanSpellChecker.createSquigglyUnderline(
          text,
          results
        );

        const correctedText = await GitCleanSpellChecker.autoCorrectText(text);

        const resultContent = [
          chalk.yellow("Spelling issues found:\n"),
          chalk.dim("Original: ") + textWithUnderlines,
          chalk.dim("Corrected: ") + chalk.green(correctedText),
          "",
          chalk.blue("Issues found:"),
          ...results.map((error) => {
            const suggestions =
              error.suggestions.length > 0
                ? ` → ${chalk.green(error.suggestions.slice(0, 3).join(", "))}`
                : " (no suggestions)";
            return chalk.red(`• ${error.word}`) + suggestions;
          }),
        ].join("\n");

        console.log(
          boxen(resultContent, {
            padding: 0.5,
            margin: 0.5,
            borderColor: "yellow",
            borderStyle: "round",
            title: "Spell Check Results",
            titleAlignment: "center",
          })
        );
      }
    } catch (error) {
      console.error(chalk.red("Spell check failed:"), getErrorMessage(error));
    }
  });

program
  .command("ai")
  .description("Generate a conventional commit message using AI")
  .action(async () => {
    showBanner();
    try {
      let message = await AiGenerator.generateCommitMessage();

      while (true) {
        console.log(
          boxen(chalk.green("AI Generated Message:\n\n") + chalk.white(message), {
            padding: 0.5,
            margin: 0.5,
            borderColor: "green",
            borderStyle: "round",
            title: "AI Suggestion",
            titleAlignment: "center",
          })
        );

        const { action } = await inquirer.prompt([
          {
            name: "action",
            type: "list",
            message: "What would you like to do?",
            choices: [
              { name: `${chalk.green("✔")}  Commit with this message`, value: "commit" },
              { name: `${chalk.blue("✎")}  Edit the message`,          value: "edit" },
              { name: `${chalk.yellow("↺")}  Regenerate`,               value: "regenerate" },
              { name: `${chalk.red("✖")}  Cancel`,                     value: "cancel" },
            ],
          },
        ]);

        if (action === "commit") {
          await executeFullGitWorkflow(message);
          break;
        } else if (action === "edit") {
          // Inquirer v12 shows `default` as a greyed-out hint, not pre-filled
          // text — typing immediately clears the field. Use readline directly
          // so we can write the current message into the input buffer, giving
          // the user a real edit-in-place experience.
          message = await new Promise<string>((resolve) => {
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout,
              terminal: true,
            });
            process.stdout.write(chalk.green("?") + " " + chalk.bold("Edit commit message: "));
            rl.question("", (answer) => {
              rl.close();
              resolve(answer.trim() || message);
            });
            rl.write(message); // pre-fill the input buffer with the current message
          });
        } else if (action === "regenerate") {
          message = await AiGenerator.generateCommitMessage();
        } else {
          console.log(
            boxen(chalk.yellow("Operation cancelled"), {
              padding: 0.5,
              margin: 0.5,
              borderColor: "yellow",
              borderStyle: "round",
            })
          );
          process.exit(0);
        }
      }
    } catch (error) {
      console.error(chalk.red("Generation failed:"), getErrorMessage(error));
      process.exit(1);
    }
  });

program
  .command("test")
  .description("Run spell checker tests with sample text")
  .action(async () => {
    await GitCleanSpellChecker.initialize();

    const testCases = [
      "Fix typo in fucntion name",
      "Add new componnet for user managment",
      "Update documention for the API",
      "Refactor databse connection handlr",
      "Implement authetication middleware",
      "Fix issue with responsivness on mobile devices",
      "Optimize perfomance of the serach algoritm",
      "Add git hooks for automatic testing",
      "Configure webpack and babel setup",
      "Deploy to production enviroment",
    ];

    console.log(
      boxen(
        chalk.blue("Running Spell Checker Tests\n\n") +
        chalk.dim("Testing with common development-related text..."),
        {
          padding: 0.5,
          margin: 0.5,
          borderColor: "blue",
          borderStyle: "round",
          title: "Spell Checker Test Suite",
          titleAlignment: "center",
        }
      )
    );

    for (let i = 0; i < testCases.length; i++) {
      const testText = testCases[i];
      console.log(chalk.dim(`\n${i + 1}. Testing: "${testText}"`));

      const results = await GitCleanSpellChecker.checkSpelling(testText);

      if (results.length === 0) {
        console.log(chalk.green("   No issues found"));
      } else {
        const corrected = await GitCleanSpellChecker.autoCorrectText(testText);
        console.log(chalk.red(`   Found ${results.length} issue(s)`));
        console.log(chalk.yellow(`   Corrected: "${corrected}"`));
      }
    }

    const stats = GitCleanSpellChecker.getSpellCheckStats();
    console.log(
      boxen(
        chalk.green("Test completed!\n\n") +
        chalk.dim(
          `Dictionary status: ${stats.hasDictionary ? "Active" : "Fallback mode"}\n`
        ) +
        chalk.dim(`Total technical terms: ${stats.technicalWordsCount}\n`) +
        chalk.dim(`Total typo rules: ${stats.typoRulesCount}`),
        {
          padding: 0.5,
          margin: 0.5,
          borderColor: "green",
          borderStyle: "round",
          title: "Test Results",
          titleAlignment: "center",
        }
      )
    );
  });

// Default action - show banner and prompt for commit
program.action(async () => {
  showBanner();

  // Check if there are any changes to commit
  const status = getGitStatus();
  if (!status.trim()) {
    console.log(chalk.yellow("No changes to commit"));
    console.log(chalk.dim("Make some changes and run `gitclean` again"));
    console.log(chalk.dim("\nTry these commands:"));
    console.log(
      chalk.dim('• gitclean spellcheck "your text" - Test spell checker')
    );
    console.log(chalk.dim("• gitclean test - Run spell checker tests"));
    console.log(chalk.dim("• gitclean setup - Install git hooks"));
    console.log(chalk.dim("• gitclean config init - Create config file"));
    return;
  }

  console.log(chalk.blue("Found changes to commit"));
  // console.log(chalk.dim("This will: git add . → git commit → git push\n"));

  await promptCommit();
});

program.parse();
