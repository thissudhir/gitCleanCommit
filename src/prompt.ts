import inquirer from "inquirer";
import chalk from "chalk";
import { GitCleanSpellChecker, SpellCheckResult } from "./spellcheck.js";
import { executeFullGitWorkflow } from "./git-integration.js";
import { writeFileSync } from "fs";
import boxen from "boxen";

interface CommitType {
  name: string;
  value: string;
  color: keyof typeof chalk;
  emoji: string;
  description: string;
}

const COMMIT_TYPES: CommitType[] = [
  {
    name: `${chalk.green("ADD")}          - Add new code or files`,
    value: "ADD",
    color: "green",
    emoji: "➕",
    description: "Added new code or files",
  },
  {
    name: `${chalk.red("FIX")}          - A bug fix`,
    value: "FIX",
    color: "red",
    emoji: "🐛",
    description: "A bug fix",
  },
  {
    name: `${chalk.yellow("UPDATE")}       - Updated a file or code`,
    value: "UPDATE",
    color: "yellow",
    emoji: "🔄",
    description: "Updated a file or code",
  },
  {
    name: `${chalk.blue("DOCS")}         - Documentation changes`,
    value: "DOCS",
    color: "blue",
    emoji: "📚",
    description: "Documentation only changes",
  },
  {
    name: `${chalk.cyan("TEST")}         - Adding tests`,
    value: "TEST",
    color: "cyan",
    emoji: "✅",
    description: "Adding missing tests or correcting existing tests",
  },
  {
    name: `${chalk.redBright("REMOVE")}       - Removing code or files`,
    value: "REMOVE",
    color: "redBright",
    emoji: "🗑️",
    description: "Removing code or files",
  },
];

function createSquigglyUnderline(
  text: string,
  errors: SpellCheckResult[]
): string {
  if (errors.length === 0) return text;

  let result = text;

  // Sort errors by position (descending) to avoid index shifting issues
  const sortedErrors = errors.sort(
    (a, b) => b.position.start - a.position.start
  );

  for (const error of sortedErrors) {
    const { word, position } = error;
    const beforeWord = result.substring(0, position.start);
    const afterWord = result.substring(position.end);

    // Create red squiggly underline effect using Unicode combining characters
    const squigglyWord = chalk.red(word + "̰".repeat(word.length));
    result = beforeWord + squigglyWord + afterWord;
  }

  return result;
}

function displaySpellCheckWarnings(errors: SpellCheckResult[]): void {
  if (errors.length === 0) return;

  const warningContent = [
    chalk.yellow("⚠️  Spelling issues detected:\n"),
    ...errors.map((error) => {
      const suggestions =
        error.suggestions.length > 0
          ? ` → ${chalk.green(error.suggestions.slice(0, 3).join(", "))}`
          : "";
      return chalk.red(`• ${error.word}`) + suggestions;
    }),
    chalk.yellow(
      "\n💡 Tip: Use auto-correct to fix these issues automatically."
    ),
  ].join("\n");

  const warningBox = boxen(warningContent, {
    padding: 1,
    margin: 1,
    borderColor: "yellow",
    borderStyle: "round",
    title: "Spell Check Results",
    titleAlignment: "center",
  });

  console.log(warningBox);
}

function handleEscapeKey(): void {
  const exitBox = boxen(
    chalk.yellow("⚠️  Operation cancelled by user (ESC pressed)") +
      "\n\n" +
      chalk.dim("Run the command again when you're ready to commit."),
    {
      padding: 1,
      margin: 1,
      borderColor: "yellow",
      borderStyle: "round",
      title: "Operation Cancelled",
      titleAlignment: "center",
    }
  );
  console.log(exitBox);
  process.exit(0);
}

type ChalkColorMethod =
  | "green"
  | "red"
  | "yellow"
  | "blue"
  | "cyan"
  | "redBright"
  | "white"
  | "black"
  | "gray"
  | "grey"
  | "magenta"
  | "bgGreen";

function isChalkColorMethod(key: keyof typeof chalk): key is ChalkColorMethod {
  const colorMethods: ChalkColorMethod[] = [
    "green",
    "red",
    "yellow",
    "blue",
    "cyan",
    "redBright",
    "white",
    "black",
    "gray",
    "grey",
    "magenta",
    "bgGreen",
  ];
  return colorMethods.includes(key as ChalkColorMethod);
}

function getChalkColor(color: ChalkColorMethod): (text: string) => string {
  return chalk[color];
}

function setupEscapeHandler(): void {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (key: Buffer | string) => {
      const keyString = key.toString();
      if (keyString === "\u001B" || keyString === "\u0003") {
        handleEscapeKey();
      }
    });
  }
}

function formatCommitMessage(
  type: CommitType,
  header: string,
  body?: string,
  breaking?: boolean,
  issues?: string
): string {
  let message = `${type.emoji} ${(chalk[type.color] as (text: string) => string)(header)}`;

  if (body) {
    message += `\n\n${chalk.dim(body)}`;
  }

  if (breaking) {
    message += `\n\n${chalk.redBright("💥 BREAKING CHANGE:")} ${chalk.redBright(
      header
    )}`;
  }

  if (issues) {
    message += `\n\n${chalk.blue(issues)}`;
  }

  return message;
}

async function handleSpellCheckAndCorrection(
  text: string,
  fieldName: string
): Promise<string> {
  const spellCheckResults = await GitCleanSpellChecker.checkSpelling(text);

  if (spellCheckResults.length === 0) {
    return text; // No spelling errors
  }

  // Display errors with squiggly underlines
  const textWithUnderlines = GitCleanSpellChecker.createSquigglyUnderline(
    text,
    spellCheckResults
  );

  console.log(
    boxen(
      chalk.yellow(`Spelling issues found in ${fieldName}:\n`) +
        textWithUnderlines +
        "\n\n" +
        spellCheckResults
          .map((error) => {
            const suggestions =
              error.suggestions.length > 0
                ? ` → ${chalk.green(error.suggestions.slice(0, 3).join(", "))}`
                : "";
            return chalk.red(`• ${error.word}`) + suggestions;
          })
          .join("\n"),
      {
        padding: 1,
        margin: 1,
        borderColor: "yellow",
        borderStyle: "round",
        title: "Spell Check",
        titleAlignment: "center",
      }
    )
  );

  // Ask user what to do
  const { action } = await inquirer.prompt([
    {
      name: "action",
      type: "list",
      message: "What would you like to do?",
      choices: [
        { name: "✨ Auto-correct all issues", value: "auto-correct" },
        { name: "✏️  Edit manually", value: "edit" },
        { name: "➡️  Continue with current text", value: "continue" },
      ],
    },
  ]);

  switch (action) {
    case "auto-correct":
      const correctedText = await GitCleanSpellChecker.autoCorrectText(text);
      console.log(
        boxen(
          chalk.green("Auto-corrected text:\n") + chalk.white(correctedText),
          {
            padding: 1,
            margin: 1,
            borderColor: "green",
            borderStyle: "round",
            title: "Auto-Correction Result",
            titleAlignment: "center",
          }
        )
      );
      return correctedText;

    case "edit":
      const { editedText } = await inquirer.prompt([
        {
          name: "editedText",
          type: "input",
          message: `Edit your ${fieldName}:`,
          default: text,
        },
      ]);
      // Recursively check the edited text
      return await handleSpellCheckAndCorrection(editedText, fieldName);

    case "continue":
    default:
      return text;
  }
}

export async function promptCommit(hookFile?: string): Promise<void> {
  setupEscapeHandler();

  // Initialize spell checker
  await GitCleanSpellChecker.initialize();
  const spellCheckStats = GitCleanSpellChecker.getSpellCheckStats();

  console.log(
    boxen(
      chalk.dim("💡 Tips:\n") +
        chalk.dim("• Press ESC at any time to cancel\n") +
        chalk.dim("• Spell checking will auto-detect issues\n") +
        chalk.dim("• Use auto-correct to fix spelling errors\n\n") +
        chalk.dim("📊 Spell Checker Status:\n") +
        chalk.dim(
          `• Dictionary: ${spellCheckStats.hasDictionary ? "✅ Loaded" : "⚠️  Fallback mode"}\n`
        ) +
        chalk.dim(
          `• Technical words: ${spellCheckStats.technicalWordsCount}\n`
        ) +
        chalk.dim(`• Typo rules: ${spellCheckStats.typoRulesCount}`),
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderColor: "blue",
        borderStyle: "round",
        title: "GitClean Helper",
        titleAlignment: "center",
      }
    )
  );

  try {
    const answers = await inquirer.prompt([
      {
        name: "type",
        type: "list",
        message: "Select the type of change you're committing:",
        choices: COMMIT_TYPES.map((type) => ({
          name: type.name,
          value: type.value,
          short: `${type.emoji} ${type.value}`,
        })),
        pageSize: 10,
      },
      {
        name: "scope",
        type: "input",
        message: "What is the scope of this change? (optional):",
        filter: (input: string) => input.trim(),
      },
      {
        name: "message",
        type: "input",
        message: "Write a short, imperative tense description of the change:",
        validate: (input: string) => {
          if (input.length < 1) {
            return "Please enter a commit message.";
          }
          if (input.length > 72) {
            return "Keep the first line under 72 characters.";
          }
          return true;
        },
        filter: (input: string) => input.trim(),
      },
      {
        name: "body",
        type: "input",
        message: "Provide a longer description of the change (optional):",
        filter: (input: string) => input.trim(),
      },
      {
        name: "breaking",
        type: "confirm",
        message: "Are there any breaking changes?",
        default: false,
      },
      {
        name: "issues",
        type: "input",
        message: 'Add issue references (e.g., "fixes #123", "closes #456"):',
        filter: (input: string) => input.trim(),
      },
    ]);

    // Spell check and potentially correct the commit message
    const correctedMessage = await handleSpellCheckAndCorrection(
      answers.message,
      "commit message"
    );

    // Spell check and potentially correct the body if provided
    let correctedBody = answers.body;
    if (answers.body && answers.body.length > 0) {
      correctedBody = await handleSpellCheckAndCorrection(
        answers.body,
        "commit body"
      );
    }

    // Update answers with corrected text
    answers.message = correctedMessage;
    answers.body = correctedBody;

    // Find the selected commit type
    const selectedType = COMMIT_TYPES.find(
      (type) => type.value === answers.type
    )!;

    // Build the commit message parts
    const breakingPrefix = answers.breaking ? "!" : "";
    const scope = answers.scope ? `(${answers.scope})` : "";
    const commitHeader = `${answers.type}${scope}${breakingPrefix}: ${answers.message}`;

    // Format the full commit message for display
    const formattedCommit = formatCommitMessage(
      selectedType,
      commitHeader,
      answers.body,
      answers.breaking,
      answers.issues
    );

    // Display the final commit message
    console.log(
      boxen(formattedCommit, {
        padding: 1,
        margin: 1,
        borderColor: selectedType.color,
        borderStyle: "round",
        title: "Final Commit Message",
        titleAlignment: "center",
      })
    );

    // Build the actual commit message for git
    let fullCommit = commitHeader;
    if (answers.body) {
      fullCommit += `\n\n${answers.body}`;
    }
    if (answers.breaking) {
      fullCommit += `\n\nBREAKING CHANGE: ${answers.message}`;
    }
    if (answers.issues) {
      fullCommit += `\n\n${answers.issues}`;
    }

    // Final confirmation
    const { confirm } = await inquirer.prompt([
      {
        name: "confirm",
        type: "confirm",
        message: "Ready to commit?",
        default: true,
      },
    ]);

    if (confirm) {
      if (hookFile) {
        writeFileSync(hookFile, fullCommit);
        console.log(
          boxen(chalk.green("✅ Commit message created successfully!"), {
            padding: 1,
            margin: 1,
            borderColor: "green",
            borderStyle: "round",
          })
        );
      } else {
        try {
          await executeFullGitWorkflow(commitHeader, answers.body);
        } catch (error) {
          console.error(
            boxen(chalk.red("❌ Failed to complete git workflow"), {
              padding: 1,
              margin: 1,
              borderColor: "red",
              borderStyle: "round",
            })
          );
          process.exit(1);
        }
      }
    } else {
      console.log(
        boxen(chalk.yellow("❌ Operation cancelled"), {
          padding: 1,
          margin: 1,
          borderColor: "yellow",
          borderStyle: "round",
        })
      );
      process.exit(1);
    }
  } catch (error) {
    if (error && typeof error === "object" && "name" in error) {
      if ((error as any).name === "ExitPromptError") {
        handleEscapeKey();
      }
    }
    throw error;
  } finally {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  }
}
