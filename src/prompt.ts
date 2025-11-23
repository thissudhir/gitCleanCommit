import inquirer from "inquirer";
import chalk from "chalk";
import { GitCleanSpellChecker, SpellCheckResult } from "./spellcheck.js";
import { executeFullGitWorkflow } from "./git-integration.js";
import { writeFileSync } from "fs";
import boxen from "boxen";
import {
  getCommitTypes,
  getCommitTypeConfig,
  CommitTypeConfig,
  loadConfig,
} from "./config.js";



// Custom inquirer prompt with real-time spell checking
class SpellCheckPrompt {
  constructor(question: any, readLine: any, answers: any) {
    this.question = question;
    this.rl = readLine;
    this.answers = answers;
    this.currentText = "";
    this.cursorPosition = 0;
    this.spellErrors = [];
    this.status = "pending";
    this.keypressListener = null;
  }

  private question: any;
  private rl: any;
  private answers: any;
  private currentText: string;
  private cursorPosition: number = 0;
  private spellErrors: SpellCheckResult[];
  private status: string;
  private done!: (value: string) => void;
  private keypressListener: any;
  private spellCheckTimeout: NodeJS.Timeout | null = null;
  private previousLineCount: number = 1;

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
            this.cursorPosition = 0;
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

      // Handle arrow key navigation
      if (key.name === "left") {
        if (this.cursorPosition > 0) {
          this.cursorPosition--;
          this.render();
        }
        return;
      }

      if (key.name === "right") {
        if (this.cursorPosition < this.currentText.length) {
          this.cursorPosition++;
          this.render();
        }
        return;
      }

      // Handle home/end keys
      if (key.name === "home") {
        this.cursorPosition = 0;
        this.render();
        return;
      }

      if (key.name === "end") {
        this.cursorPosition = this.currentText.length;
        this.render();
        return;
      }

      // Handle text input
      if (key.name === "backspace") {
        if (this.cursorPosition > 0) {
          this.currentText = 
            this.currentText.slice(0, this.cursorPosition - 1) + 
            this.currentText.slice(this.cursorPosition);
          this.cursorPosition--;
        }
      } else if (str && str.length === 1 && !key.ctrl && !key.meta) {
        // Insert character at cursor position
        this.currentText = 
          this.currentText.slice(0, this.cursorPosition) + 
          str + 
          this.currentText.slice(this.cursorPosition);
        this.cursorPosition++;
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
    // Clear any pending spell check timeout
    if (this.spellCheckTimeout) {
      clearTimeout(this.spellCheckTimeout);
      this.spellCheckTimeout = null;
    }
    
    if (this.keypressListener) {
      process.stdin.removeListener("keypress", this.keypressListener);
      this.keypressListener = null;
    }
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }

  private async performSpellCheck(): Promise<void> {
    // Clear any existing timeout to prevent lag
    if (this.spellCheckTimeout) {
      clearTimeout(this.spellCheckTimeout);
      this.spellCheckTimeout = null;
    }

    // Immediately clear errors if text is empty - no debounce needed
    if (this.currentText.length === 0) {
      this.spellErrors = [];
      return;
    }

    // Debounce spell checking for better performance
    this.spellCheckTimeout = setTimeout(async () => {
      try {
        this.spellErrors = await GitCleanSpellChecker.checkSpelling(
          this.currentText
        );
        // Only render if we're still in pending status (not answered yet)
        if (this.status === "pending") {
          this.render();
        }
      } catch (error) {
        // Silent error handling for spell check
        this.spellErrors = [];
      }
    }, 150); // Reduced from 200ms to 150ms for better responsiveness
  }

  private render(): void {
    if (this.status === "answered") return;

    // First, move cursor back to the start of the first line of our previous render
    // We need to move up (previousLineCount - 1) lines
    if (this.previousLineCount > 1) {
      process.stdout.write(`\x1b[${this.previousLineCount - 1}A`);
    }
    
    // Now clear all lines from the previous render
    for (let i = 0; i < this.previousLineCount; i++) {
      process.stdout.write("\r\x1b[K"); // Clear current line
      if (i < this.previousLineCount - 1) {
        process.stdout.write("\n"); // Move to next line
      }
    }
    
    // Move cursor back to the start
    if (this.previousLineCount > 1) {
      process.stdout.write(`\x1b[${this.previousLineCount - 1}A`);
    }
    process.stdout.write("\r");

    // Show question
    const questionText = this.question.message;
    const promptPrefix = `${chalk.cyan("?")} ${chalk.bold(questionText)} `;
    process.stdout.write(promptPrefix);

    // Show text with spell checking and cursor
    const displayText = this.createDisplayText();
    process.stdout.write(displayText);
    
    // Calculate how many lines we're using NOW (for next render)
    // Get terminal width (default to 80 if not available)
    const terminalWidth = process.stdout.columns || 80;
    // Strip ANSI codes to get actual text length for line calculation
    const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');
    const promptLength = stripAnsi(promptPrefix).length;
    const textLength = this.currentText.length;
    const totalLength = promptLength + textLength;
    this.previousLineCount = Math.ceil(totalLength / terminalWidth);
    
    // Move cursor to correct position accounting for line wrapping
    const cursorAbsolutePosition = promptLength + this.cursorPosition;
    const endAbsolutePosition = promptLength + textLength;
    
    // Calculate which line the cursor should be on (0-indexed from current line)
    const cursorLine = Math.floor(cursorAbsolutePosition / terminalWidth);
    const endLine = Math.floor(endAbsolutePosition / terminalWidth);
    
    // Calculate column position on that line
    const cursorColumn = cursorAbsolutePosition % terminalWidth;
    const endColumn = endAbsolutePosition % terminalWidth;
    
    // Move cursor to correct position
    if (endLine > cursorLine) {
      // Need to move up lines
      const linesToMoveUp = endLine - cursorLine;
      process.stdout.write(`\x1b[${linesToMoveUp}A`);
      // Then move to correct column (from start of line)
      if (cursorColumn > 0) {
        process.stdout.write(`\x1b[${cursorColumn}C`);
      }
    } else if (endColumn > cursorColumn) {
      // Same line, just move back
      const charsToMoveBack = endColumn - cursorColumn;
      process.stdout.write(`\x1b[${charsToMoveBack}D`);
    }
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
  type: CommitTypeConfig,
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

  // Load configuration
  const config = loadConfig();
  const promptsConfig = config.prompts || {
    scope: true,
    body: false,
    breaking: false,
    issues: false,
  };

  try {
    // Build questions array based on config
    const questions: any[] = [
      {
        name: "type",
        type: "list",
        message: "Select the type of change you're committing:",
        choices: getCommitTypes(),
        pageSize: 10,
        theme: {
          helpMode: "never",
        },
      },
    ];

    // Conditionally add scope prompt
    if (promptsConfig.scope) {
      questions.push({
        name: "scope",
        type: "input",
        message: "What is the scope of this change? (optional):",
        filter: (input: string) => input.trim(),
      });
    }

    // Always add message prompt (required)
    questions.push({
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
    });

    // Conditionally add body prompt
    if (promptsConfig.body) {
      questions.push({
        name: "body",
        type: "spellcheck" as any,
        message: "Provide a longer description (optional):",
        filter: (input: string) => input.trim(),
      });
    }

    // Conditionally add breaking changes prompt
    if (promptsConfig.breaking) {
      questions.push({
        name: "breaking",
        type: "confirm",
        message: "Are there any breaking changes?",
        default: false,
      });
    }

    // Conditionally add issues prompt
    if (promptsConfig.issues) {
      questions.push({
        name: "issues",
        type: "input",
        message: 'Add issue references (e.g., "fixes #123", "closes #456"):',
        filter: (input: string) => input.trim(),
      });
    }

    // Prompt user with configured questions
    const answers = await inquirer.prompt(questions);

    // Find the selected commit type from config
    const selectedType = getCommitTypeConfig(answers.type);

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
          await executeFullGitWorkflow(fullCommit);
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
