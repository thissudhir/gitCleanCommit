import inquirer from "inquirer";
import chalk from "chalk";
import { checkSpelling } from "./spellcheck.js";
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

function createSquigglyUnderline(text: string, typos: string[]): string {
  let result = text;

  for (const typo of typos) {
    const regex = new RegExp(`\\b${typo}\\b`, "gi");
    result = result.replace(regex, (match) => {
      const squiggly = "\u0330".repeat(match.length);
      return chalk.red(match + squiggly);
    });
  }

  return result;
}

function displayTypoWarnings(typos: string[]): void {
  if (typos.length > 0) {
    const warningBox = boxen(
      chalk.yellow("⚠️  Potential spelling issues detected:\n") +
        typos
          .map((typo) => chalk.red(`• ${typo} ${"\u0330".repeat(typo.length)}`))
          .join("\n") +
        chalk.yellow("\n\nPlease review your commit message."),
      {
        padding: 1,
        margin: 1,
        borderColor: "yellow",
        borderStyle: "round",
        title: "Spelling Check",
        titleAlignment: "center",
      }
    );
    console.log(warningBox);
  }
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

// Type guard to check if a key is a color method
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

// Safe color accessor function
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

export async function promptCommit(hookFile?: string): Promise<void> {
  setupEscapeHandler();

  console.log(
    boxen(chalk.dim("💡 Tip: Press ESC at any time to cancel"), {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderColor: "blue",
      borderStyle: "round",
    })
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

    // Spell check
    const typos = checkSpelling(answers.message);
    const bodyTypos = answers.body ? checkSpelling(answers.body) : [];
    const allTypos = [...typos, ...bodyTypos];

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

    // Display the generated commit message in a box
    console.log(
      boxen(formattedCommit, {
        padding: 1,
        margin: 1,
        borderColor: selectedType.color,
        borderStyle: "round",
        title: "Generated Commit Message",
        titleAlignment: "center",
      })
    );

    // Show typo warnings if any
    if (allTypos.length > 0) {
      const highlightedHeader = createSquigglyUnderline(commitHeader, typos);
      let highlightedBody = answers.body || "";

      if (answers.body && bodyTypos.length > 0) {
        highlightedBody = createSquigglyUnderline(answers.body, bodyTypos);
      }

      const warningMessage = [
        chalk.yellow("Message with issues highlighted:"),
        `${selectedType.emoji} ${
          isChalkColorMethod(selectedType.color)
            ? getChalkColor(selectedType.color)(highlightedHeader)
            : chalk.white(highlightedHeader)
        }`,
        ...(answers.body
          ? ["", chalk.gray("Body:"), chalk.gray(highlightedBody)]
          : []),
      ].join("\n");

      console.log(
        boxen(warningMessage, {
          padding: 1,
          margin: { top: 1, bottom: 1 },
          borderColor: "yellow",
          borderStyle: "round",
          title: "Spelling Issues Detected",
          titleAlignment: "center",
        })
      );

      displayTypoWarnings(allTypos);
    }

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
        message:
          allTypos.length > 0
            ? "Proceed with potential spelling issues?"
            : "Ready to commit?",
        default: allTypos.length === 0,
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
