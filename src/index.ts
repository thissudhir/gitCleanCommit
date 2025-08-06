#!/usr/bin/env node

import { Command } from "commander";
import { showBanner } from "./banner.js";
import { promptCommit } from "./prompt.js";
import {
  setupGitHook,
  removeGitHook,
  getGitStatus,
} from "./git-integration.js";
import { GitCleanSpellChecker } from "./spellcheck.js";
import { ErrorHandler } from "./utils/error-handler.js";
import { ConfigManager } from "./config/config-manager.js";
import { TemplateManager } from "./templates/template-manager.js";
import chalk from "chalk";
import boxen from "boxen";

const program = new Command();

program
  .name("gitclean")
  .description("Clean, conventional commits made easy")
  .version("1.0.5", "-v, --version", "Show version information");

program
  .command("setup")
  .alias("install")
  .description("Install GitClean git hooks")
  .action(async () => {
    try {
      await setupGitHook();
      console.log(chalk.green("✅ GitClean hooks installed successfully!"));
    } catch (error) {
      ErrorHandler.handleError(error, "Failed to install hooks");
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
      console.log(chalk.green("✅ GitClean hooks removed successfully!"));
    } catch (error) {
      ErrorHandler.handleError(error, "Failed to remove hooks");
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
      console.log(chalk.blue("📋 Git Status:"));
      console.log(status);
    } else {
      console.log(chalk.green("✅ Working directory clean"));
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
          chalk.blue("📊 Spell Checker Information\n\n") +
            chalk.dim(`Initialized: ${stats.isInitialized ? "✅" : "❌"}\n`) +
            chalk.dim(
              `Dictionary: ${stats.hasDictionary ? "✅ Loaded" : "⚠️  Fallback mode"}\n`
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
          '💡 Tip: Provide text to check: gitclean spellcheck "your text here"'
        )
      );
      return;
    }

    console.log(chalk.blue("\n🔍 Checking spelling...\n"));

    try {
      const results = await GitCleanSpellChecker.checkSpelling(text);

      if (results.length === 0) {
        console.log(
          boxen(
            chalk.green("✅ No spelling issues found!\n\n") +
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
          chalk.yellow("⚠️  Spelling issues found:\n"),
          chalk.dim("Original: ") + textWithUnderlines,
          chalk.dim("Corrected: ") + chalk.green(correctedText),
          "",
          chalk.blue("📝 Issues found:"),
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
      ErrorHandler.handleError(error, "Spell check failed");
    }
  });

program
  .command("config")
  .description("Manage GitClean configuration")
  .option("--init", "Create default configuration file")
  .option("--show", "Show current configuration")
  .option("--path", "Show configuration file path")
  .action(async (options) => {
    try {
      if (options.init) {
        ConfigManager.createDefaultConfig();
        const configPath = ConfigManager.getCurrentConfigPath();
        ErrorHandler.showSuccess(
          "Default configuration file created successfully!",
          [`Configuration saved to: ${configPath}`]
        );
      } else if (options.show) {
        const config = ConfigManager.loadConfig();
        console.log(
          boxen(
            chalk.blue("📋 Current GitClean Configuration\n\n") +
              JSON.stringify(config, null, 2),
            {
              padding: 0.5,
              margin: 0.5,
              borderColor: "blue",
              borderStyle: "round",
              title: "Configuration",
              titleAlignment: "center",
            }
          )
        );
      } else if (options.path) {
        const configPath = ConfigManager.getCurrentConfigPath();
        const exists = ConfigManager.configExists();
        console.log(
          boxen(
            chalk.blue("📁 Configuration File Path\n\n") +
              chalk.dim(`Path: ${configPath}\n`) +
              chalk.dim(`Exists: ${exists ? "✅ Yes" : "❌ No"}`),
            {
              padding: 0.5,
              margin: 0.5,
              borderColor: "blue",
              borderStyle: "round",
              title: "Config Path",
              titleAlignment: "center",
            }
          )
        );
      } else {
        console.log(chalk.yellow("💡 Use --init, --show, or --path options"));
        console.log(chalk.dim("Examples:"));
        console.log(chalk.dim("  gitclean config --init   # Create default config"));
        console.log(chalk.dim("  gitclean config --show   # Show current config"));
        console.log(chalk.dim("  gitclean config --path   # Show config file path"));
      }
    } catch (error) {
      ErrorHandler.handleError(error, "Configuration command failed");
      process.exit(1);
    }
  });

program
  .command("templates")
  .alias("tpl")
  .description("Manage commit message templates")
  .option("--list", "List all available templates")
  .option("--add-defaults", "Add default templates to configuration")
  .option("--show <name>", "Show specific template details")
  .option("--remove <name>", "Remove a template")
  .action(async (options) => {
    try {
      if (options.list) {
        const templates = TemplateManager.getTemplates();
        if (templates.length === 0) {
          console.log(chalk.yellow("📝 No templates found"));
          console.log(chalk.dim("Use --add-defaults to add default templates"));
          return;
        }

        console.log(
          boxen(
            chalk.blue("📝 Available Templates\n\n") +
              templates.map(template => 
                `${chalk.green(template.name)}: ${template.type} - ${template.message}`
              ).join("\n"),
            {
              padding: 0.5,
              margin: 0.5,
              borderColor: "blue",
              borderStyle: "round",
              title: "Commit Templates",
              titleAlignment: "center",
            }
          )
        );
      } else if (options.addDefaults) {
        const defaultTemplates = TemplateManager.getDefaultTemplates();
        TemplateManager.addTemplatesToConfig(defaultTemplates);
        ErrorHandler.showSuccess(
          "Default templates added successfully!",
          [`Added ${defaultTemplates.length} templates to configuration`]
        );
      } else if (options.show) {
        const template = TemplateManager.getTemplate(options.show);
        if (!template) {
          console.log(chalk.red(`❌ Template "${options.show}" not found`));
          return;
        }

        console.log(
          boxen(
            chalk.blue(`📋 Template: ${template.name}\n\n`) +
              chalk.dim(`Type: ${template.type}\n`) +
              chalk.dim(`Message: ${template.message}\n`) +
              (template.scope ? chalk.dim(`Scope: ${template.scope}\n`) : "") +
              (template.body ? chalk.dim(`Body: ${template.body}\n`) : "") +
              chalk.dim(`Breaking: ${template.breaking ? "Yes" : "No"}`),
            {
              padding: 0.5,
              margin: 0.5,
              borderColor: "blue",
              borderStyle: "round",
              title: "Template Details",
              titleAlignment: "center",
            }
          )
        );
      } else if (options.remove) {
        const removed = TemplateManager.removeTemplate(options.remove);
        if (removed) {
          ErrorHandler.showSuccess(`Template "${options.remove}" removed successfully!`);
        } else {
          console.log(chalk.red(`❌ Template "${options.remove}" not found`));
        }
      } else {
        console.log(chalk.yellow("💡 Use --list, --add-defaults, --show <name>, or --remove <name>"));
        console.log(chalk.dim("Examples:"));
        console.log(chalk.dim("  gitclean templates --list"));
        console.log(chalk.dim("  gitclean templates --add-defaults"));
        console.log(chalk.dim("  gitclean templates --show feature"));
        console.log(chalk.dim("  gitclean templates --remove bugfix"));
      }
    } catch (error) {
      ErrorHandler.handleError(error, "Template command failed");
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
        chalk.blue("🧪 Running Spell Checker Tests\n\n") +
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
        console.log(chalk.green("   ✅ No issues found"));
      } else {
        const corrected = await GitCleanSpellChecker.autoCorrectText(testText);
        console.log(chalk.red(`   ❌ Found ${results.length} issue(s)`));
        console.log(chalk.yellow(`   🔧 Corrected: "${corrected}"`));
      }
    }

    const stats = GitCleanSpellChecker.getSpellCheckStats();
    console.log(
      boxen(
        chalk.green("✅ Test completed!\n\n") +
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
    console.log(chalk.yellow("⚠️  No changes to commit"));
    console.log(chalk.dim("Make some changes and run `gitclean` again"));
    console.log(chalk.dim("\n💡 Try these commands:"));
    console.log(
      chalk.dim('• gitclean spellcheck "your text" - Test spell checker')
    );
    console.log(chalk.dim("• gitclean test - Run spell checker tests"));
    console.log(chalk.dim("• gitclean setup - Install git hooks"));
    return;
  }

  console.log(chalk.blue("🔍 Found changes to commit"));
  console.log(chalk.dim("This will: git add . → git commit → git push\n"));

  await promptCommit();
});

program.parse();
