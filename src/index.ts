#!/usr/bin/env node

import { Command } from "commander";
import { showBanner } from "./banner.js";
import { promptCommit } from "./prompt.js";
import {
  setupGitHook,
  removeGitHook,
  getGitStatus,
} from "./git-integration.js";
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

// Default action - show banner and prompt for commit
program.action(async () => {
  showBanner();

  // Check if there are any changes to commit
  const status = getGitStatus();
  if (!status.trim()) {
    console.log(chalk.yellow("⚠️  No changes to commit"));
    console.log(chalk.dim("Make some changes and run `gitclean` again"));
    return;
  }

  console.log(chalk.blue("🔍 Found changes to commit"));
  console.log(chalk.dim("This will: git add . → git commit → git push\n"));

  await promptCommit();
});

program.parse();
