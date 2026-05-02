import type { Command } from "commander";
import { GitCleanSpellChecker } from "../spellcheck.js";
import chalk from "chalk";
import boxen from "boxen";

export function registerSpellCheckCommands(program: Command): void {
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
            chalk.dim(`Dictionary: ${stats.hasDictionary ? "Loaded" : "Fallback mode"}\n`) +
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
        console.log(chalk.yellow('Tip: Provide text to check: gitclean spellcheck "your text here"'));
        return;
      }

      console.log(chalk.blue("\nChecking spelling...\n"));

      try {
        const results = await GitCleanSpellChecker.checkSpelling(text);

        if (results.length === 0) {
          console.log(
            boxen(
              chalk.green("No spelling issues found!\n\n") + chalk.dim(`Checked text: "${text}"`),
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
          const textWithUnderlines = GitCleanSpellChecker.createSquigglyUnderline(text, results);
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
        const msg = error instanceof Error ? error.message : String(error);
        console.error(chalk.red("Spell check failed:"), msg);
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
          chalk.dim(`Dictionary status: ${stats.hasDictionary ? "Active" : "Fallback mode"}\n`) +
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
}
