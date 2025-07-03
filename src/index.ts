#!/usr/bin/env node

import { Command } from "commander";
import { showBanner } from "./banner.js";
import { promptCommit } from "./prompt.js";
import { setupGitHook, removeGitHook } from "./git-integration.js";
import chalk from "chalk";

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

const program = new Command();

program
  .name("gitclean")
  .description("Clean, conventional commits made easy")
  .version("1.0.0");

program
  .command("setup")
  .alias("install")
  .description("Install GitClean git hooks")
  .action(async () => {
    try {
      await setupGitHook();
      console.log(chalk.green("✅ GitClean hooks installed successfully!"));
    } catch (error) {
      console.error(
        chalk.red("❌ Failed to install hooks:"),
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
      console.log(chalk.green("✅ GitClean hooks removed successfully!"));
    } catch (error) {
      console.error(
        chalk.red("❌ Failed to remove hooks:"),
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

// Default action - show banner and prompt for commit
program.action(() => {
  showBanner();
  promptCommit();
});

program.parse();
