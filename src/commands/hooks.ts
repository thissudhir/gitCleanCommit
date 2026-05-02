import type { Command } from "commander";
import { setupGitHook, removeGitHook } from "../git-integration.js";
import { getErrorMessage } from "../utils.js";
import chalk from "chalk";

export function registerHooksCommands(program: Command): void {
  program
    .command("setup")
    .alias("install")
    .description("Install GitClean git hooks")
    .action(async () => {
      try {
        await setupGitHook();
        console.log(chalk.green("GitClean hooks installed successfully!"));
      } catch (error) {
        console.error(chalk.red("Failed to install hooks:"), getErrorMessage(error));
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
        console.error(chalk.red("Failed to remove hooks:"), getErrorMessage(error));
        process.exit(1);
      }
    });
}
