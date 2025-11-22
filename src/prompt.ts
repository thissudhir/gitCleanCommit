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
  description: string;
}

const COMMIT_TYPES: CommitType[] = [
  {
    name: `${chalk.green("ADD")}          - Add new code or files`,
    value: "ADD",
    color: "green",
    description: "Added new code or files",
  },
  {
    name: `${chalk.red("FIX")}          - A bug fix`,
    value: "FIX",
    color: "red",
    description: "A bug fix",
  },
  {
    name: `${chalk.yellow("UPDATE")}       - Updated a file or code`,
    value: "UPDATE",
    color: "yellow",
    description: "Updated a file or code",
  },
  {
    name: `${chalk.blue("DOCS")}         - Documentation changes`,
    value: "DOCS",
    color: "blue",
    description: "Documentation only changes",
  },
  {
    name: `${chalk.cyan("TEST")}         - Adding tests`,
    value: "TEST",
    color: "cyan",
    description: "Adding missing tests or correcting existing tests",
  },
  {
    name: `${chalk.redBright("REMOVE")}       - Removing code or files`,
    value: "REMOVE",
    color: "redBright",
    description: "Removing code or files",
  },
];

// Custom inquirer prompt with real-time spell checking
class SpellCheckPrompt {
  constructor(question: any, readLine: any, answers: any) {
    this.question = question;
    this.rl = readLine;
    this.answers = answers;
    this.currentText = "";
    this.spellErrors = [];
    this.status = "pending";
    this.keypressListener = null;
  }

  private question: any;
  private rl: any;
  private answers: any;
  private currentText: string;
  private spellErrors: SpellCheckResult[];
  private status: string;
  private done!: (value: string) => void;
  private keypressListener: any;

  run(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.done = resolve;
      this.render();
      this.setupKeyHandlers();
    });
  }

  private setupKeyHandlers(): void {
    // Store the keypress listener so we can remove it later
    this.keypressListener = async (str: string, key: any) => {
      if (!key) return;

      if (key.name === "return" || key.name === "enter") {
        this.cleanup();
        // process.stdout.write("\n");

        // Validation
        if (this.question.validate) {
          const validation = await this.question.validate(this.currentText);
          if (validation !== true) {
            console.log(chalk.red(`>> ${validation}`));
            this.currentText = "";
            this.spellErrors = [];
            this.render();
            this.setupKeyHandlers();
            return;
          }
        }

        // Filter
        let result = this.currentText;
        if (this.question.filter) {
          result = await this.question.filter(this.currentText);
        }

        this.status = "answered";
        this.done(result);
        return;
      }

      if (key.name === "escape") {
        this.cleanup();
        process.exit(0);
      }

      // Handle text input
      if (key.name === "backspace") {
        this.currentText = this.currentText.slice(0, -1);
      } else if (str && str.length === 1 && !key.ctrl && !key.meta) {
        this.currentText += str;
      }

      await this.performSpellCheck();
      this.render();
    };

    // Enable keypress events
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on("keypress", this.keypressListener);
  }

  private cleanup(): void {
    if (this.keypressListener) {
      process.stdin.removeListener("keypress", this.keypressListener);
      this.keypressListener = null;
    }
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }

  private async performSpellCheck(): Promise<void> {
    if (this.currentText.length === 0) {
      this.spellErrors = [];
      return;
    }

    clearTimeout((this as any).spellCheckTimeout);
    (this as any).spellCheckTimeout = setTimeout(async () => {
      try {
        this.spellErrors = await GitCleanSpellChecker.checkSpelling(
          this.currentText
        );
        this.render();
      } catch (error) {
        // Silent error handling for spell check
        this.spellErrors = [];
      }
    }, 200);
  }

  private render(): void {
    if (this.status === "answered") return;

    // Clear current line
    process.stdout.write("\r\x1b[K");

    // Show question
    const questionText = this.question.message;
    process.stdout.write(`${chalk.cyan("?")} ${chalk.bold(questionText)} `);

    // Show text with spell checking
    const displayText = this.createDisplayText();
    process.stdout.write(displayText);
  }

  private createDisplayText(): string {
    if (this.spellErrors.length === 0) {
      return this.currentText;
    }

    let result = this.currentText;

    // Sort errors by position (descending) to avoid index shifting
    const sortedErrors = this.spellErrors.sort(
      (a, b) => b.position.start - a.position.start
    );

    for (const error of sortedErrors) {
      const { word, position } = error;
      const beforeWord = result.substring(0, position.start);
      const afterWord = result.substring(position.end);

      // Create red underlined text for misspelled words
      const highlightedWord = chalk.red.underline(word);
      result = beforeWord + highlightedWord + afterWord;
    }

    return result;
  }
}

// Register custom prompt type with proper typing
inquirer.registerPrompt("spellcheck", SpellCheckPrompt as any);

function handleEscapeKey(): void {
  const exitBox = boxen(
    chalk.yellow("Operation cancelled by user (ESC pressed)") +
      "\n\n" +
      chalk.dim("Run the command again when you're ready to commit."),
    {
      padding: 0.5,
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
  let message = `${(chalk[type.color] as (text: string) => string)(header)}`;

  if (body) {
    message += `\n\n${chalk.dim(body)}`;
  }

  if (breaking) {
    message += `\n\n${chalk.redBright("BREAKING CHANGE:")} ${chalk.redBright(
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

  // Initialize spell checker
  await GitCleanSpellChecker.initialize();

  console.log(
    chalk.blue("Real-time spell checking enabled for text inputs!\n")
  );

  try {
    // All questions in one inquirer.prompt with real-time spell checking
    const answers = await inquirer.prompt([
      {
        name: "type",
        type: "list",
        message: "Select the type of change you're committing:",
        choices: COMMIT_TYPES.map((type) => ({
          name: type.name,
          value: type.value,
          short: type.value,
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
        type: "spellcheck" as any,
        message: "Write a short, commit message:",
        validate: (input: string) => {
          if (input.trim().length < 1) {
            return "Please enter a commit message.";
          }
          if (input.trim().length > 72) {
            return "Keep the first line under 72 characters.";
          }
          return true;
        },
        filter: (input: string) => input.trim(),
      },
      {
        name: "body",
        type: "spellcheck" as any,
        message: "Provide a longer description (optional):",
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
        padding: 0.5,
        margin: 0.5,
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
          boxen(chalk.green("Commit message created successfully!"), {
            padding: 0.5,
            margin: 0.5,
            borderColor: "green",
            borderStyle: "round",
          })
        );
      } else {
        try {
          await executeFullGitWorkflow(commitHeader, answers.body);
        } catch (error) {
          console.error(
            boxen(chalk.red("Failed to complete git workflow"), {
              padding: 0.5,
              margin: 0.5,
              borderColor: "red",
              borderStyle: "round",
            })
          );
          process.exit(1);
        }
      }
    } else {
      console.log(
        boxen(chalk.yellow("Operation cancelled"), {
          padding: 0.5,
          margin: 0.5,
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
