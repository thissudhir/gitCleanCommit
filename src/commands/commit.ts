import type { Command } from "commander";
import { showBanner } from "../banner.js";
import { promptCommit, runAiCommitFlow } from "../prompt.js";
import { getGitStatus } from "../git-integration.js";
import chalk from "chalk";

export function registerCommitCommands(program: Command): void {
  program
    .command("commit")
    .description("Create a conventional commit interactively")
    .option("--hook <file>", "Hook mode: write to commit message file")
    .action(async (options) => {
      showBanner();
      await promptCommit(options.hook);
    });

  program
    .command("ai")
    .description("Generate a conventional commit message using AI")
    .action(async () => {
      showBanner("ai");
      await runAiCommitFlow();
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
}

export function registerDefaultAction(program: Command): void {
  program.action(async () => {
    showBanner();

    const status = getGitStatus();
    if (!status.trim()) {
      console.log(chalk.yellow("No changes to commit"));
      console.log(chalk.dim("Make some changes and run `gitclean` again"));
      console.log(chalk.dim("\nTry these commands:"));
      console.log(chalk.dim('• gitclean spellcheck "your text" - Test spell checker'));
      console.log(chalk.dim("• gitclean test - Run spell checker tests"));
      console.log(chalk.dim("• gitclean setup - Install git hooks"));
      console.log(chalk.dim("• gitclean config init - Create config file"));
      return;
    }

    console.log(chalk.blue("Found changes to commit"));
    await promptCommit();
  });
}
