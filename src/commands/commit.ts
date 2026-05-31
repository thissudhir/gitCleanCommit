import type { Command } from "commander";
import { showBanner } from "../banner.js";
import { promptCommit, runAiCommitFlow } from "../prompt.js";
import { getGitStatus } from "../git-integration.js";
import chalk from "chalk";
import boxen from "boxen";

export function registerCommitCommands(program: Command): void {
  program
    .command("commit")
    .description("Create a conventional commit interactively")
    .option("--hook <file>", "Hook mode: write to commit message file")
    .option("--amend", "Amend the last commit message")
    .action(async (options) => {
      if (!options.amend && !options.hook) showBanner();
      await promptCommit(options.hook, options.amend ?? false);
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
      console.log(
        boxen(
          chalk.yellow("Nothing to commit") + "\n\n" +
          chalk.dim("Make some changes and run ") + chalk.white("`gitclean`") + chalk.dim(" again.\n\n") +
          chalk.dim('• gitclean spellcheck "text"') + chalk.dim("   test spell checker\n") +
          chalk.dim("• gitclean setup             ") + chalk.dim("install git hooks\n") +
          chalk.dim("• gitclean config init       ") + chalk.dim("create config file"),
          {
            padding: 0.5,
            margin: { top: 0, bottom: 1, left: 0, right: 0 },
            borderColor: "yellow",
            borderStyle: "round",
            title: "Working directory clean",
            titleAlignment: "center",
          }
        )
      );
      return;
    }

    console.log(chalk.blue("Found changes to commit"));
    await promptCommit();
  });
}
