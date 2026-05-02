import inquirer from "inquirer";
import chalk from "chalk";
import { GitCleanSpellChecker, SpellCheckResult } from "./spellcheck.js";
import {
  executeFullGitWorkflow,
  executeGitAmend,
  getChangedFiles,
  getDiffNumstat,
  getScopeFromBranch,
  getRecentScopes,
  getLastCommitMessage,
} from "./git-integration.js";
import { writeFileSync } from "fs";
import boxen from "boxen";
import {
  getCommitTypes,
  getCommitTypeConfig,
  CommitTypeConfig,
  loadConfig,
} from "./config.js";
import { AiGenerator } from "./ai-generator.js";

function parseConventionalCommit(msg: string): { type: string; scope: string; message: string } | null {
  const match = msg.match(/^([A-Z]+)(?:\(([^)]+)\))?!?: (.+)/);
  if (!match) return null;
  return { type: match[1], scope: match[2] ?? "", message: match[3] };
}


// Custom inquirer prompt with real-time spell checking
class SpellCheckPrompt {
  constructor(question: any, readLine: any, answers: any) {
    this.question = question;
    this.rl = readLine;
    this.answers = answers;
    // Pre-fill with the default value (e.g. from AI-generated message)
    this.currentText = question.default ?? "";
    this.cursorPosition = this.currentText.length;
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

    // Show text with spell checking
    const displayText = this.createDisplayText();
    process.stdout.write(displayText);

    // Live character counter (shown when charLimit is set on the question)
    const charLimit: number | undefined = (this.question as any).charLimit;
    let counterText = "";
    if (charLimit) {
      const len = this.currentText.length;
      const counterColor = len > charLimit ? chalk.red : len > Math.floor(charLimit * 0.8) ? chalk.yellow : chalk.dim;
      counterText = counterColor(` ${len}/${charLimit}`);
      process.stdout.write(counterText);
    }

    // Calculate line count for next render — include counter in total width
    const terminalWidth = process.stdout.columns || 80;
    const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');
    const promptLength = stripAnsi(promptPrefix).length;
    const textLength = this.currentText.length;
    const counterLength = stripAnsi(counterText).length;
    this.previousLineCount = Math.max(1, Math.ceil((promptLength + textLength + counterLength) / terminalWidth));

    // Cursor positioning — counter sits after the text, so endAbsolutePosition includes it
    const cursorAbsolutePosition = promptLength + this.cursorPosition;
    const endAbsolutePosition = promptLength + textLength + counterLength;

    const cursorLine = Math.floor(cursorAbsolutePosition / terminalWidth);
    const endLine = Math.floor(endAbsolutePosition / terminalWidth);
    const cursorColumn = cursorAbsolutePosition % terminalWidth;
    const endColumn = endAbsolutePosition % terminalWidth;

    if (endLine > cursorLine) {
      const linesToMoveUp = endLine - cursorLine;
      process.stdout.write(`\x1b[${linesToMoveUp}A`);
      if (cursorColumn > 0) process.stdout.write(`\x1b[${cursorColumn}C`);
    } else if (endColumn > cursorColumn) {
      process.stdout.write(`\x1b[${endColumn - cursorColumn}D`);
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
  let message = `${((chalk as any)[type.color] as (text: string) => string)(header)}`;

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

export async function runAiCommitFlow(hookFile?: string): Promise<void> {
  try {
    const selectedFiles = hookFile ? ["."] : await promptFileSelection();
    if (!hookFile && selectedFiles.length === 0) {
      console.log(chalk.yellow("No files selected. Aborting."));
      process.exit(0);
    }

    let message = await AiGenerator.generateCommitMessage(selectedFiles);

    while (true) {
      console.log(
        boxen(chalk.green("AI Generated Message:\n\n") + chalk.white(message), {
          padding: 0.5,
          margin: 0.5,
          borderColor: "green",
          borderStyle: "round",
          title: "AI Suggestion",
          titleAlignment: "center",
        })
      );

      const { action } = await inquirer.prompt([
        {
          name: "action",
          type: "list",
          message: "What would you like to do?",
          choices: [
            { name: chalk.green("✔ Commit with this message"),  value: "commit" },
            { name: chalk.blue("✎ Edit the message"),           value: "edit" },
            { name: chalk.yellow("↺ Regenerate"),               value: "regenerate" },
            { name: chalk.cyan("↺ Regenerate with hint..."),    value: "regenerate_hint" },
            { name: chalk.red("✖ Cancel"),                      value: "cancel" },
          ],
        },
      ]);

      if (action === "commit") {
        if (hookFile) {
          writeFileSync(hookFile, message);
        } else {
          await executeFullGitWorkflow(message, selectedFiles);
        }
        break;
      } else if (action === "edit") {
        const { edited } = await inquirer.prompt([{
          name: "edited",
          type: "spellcheck" as any,
          message: "Edit commit message:",
          default: message,
          charLimit: 72,
          validate: (v: string) => v.trim().length > 0 || "Message cannot be empty",
          filter: (v: string) => v.trim(),
        } as any]);
        message = edited;
      } else if (action === "regenerate") {
        message = await AiGenerator.generateCommitMessage(selectedFiles);
      } else if (action === "regenerate_hint") {
        const { hint } = await inquirer.prompt([{
          name: "hint",
          type: "input",
          message: "Hint for AI (e.g. 'focus on the auth changes'):",
          validate: (v: string) => v.trim().length > 0 || "Enter a hint",
        }]);
        message = await AiGenerator.generateCommitMessage(selectedFiles, hint.trim());
      } else {
        console.log(
          boxen(chalk.yellow("Operation cancelled"), {
            padding: 0.5,
            margin: 0.5,
            borderColor: "yellow",
            borderStyle: "round",
          })
        );
        process.exit(0);
      }
    }
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && (error as any).name === "ExitPromptError") {
      handleEscapeKey();
      return;
    }
    console.error(chalk.red("Generation failed:"), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const STATUS_LABEL: Record<string, string> = {
  modified:  chalk.yellow("modified "),
  added:     chalk.green("new file "),
  deleted:   chalk.red("deleted  "),
  renamed:   chalk.blue("renamed  "),
  untracked: chalk.dim("untracked"),
};

async function promptFileSelection(): Promise<string[]> {
  const files = getChangedFiles();
  if (files.length === 0) return [];

  const stats = getDiffNumstat();

  const { selected } = await inquirer.prompt([
    {
      name: "selected",
      type: "checkbox",
      message: "Select files to stage:",
      choices: files.map((f) => {
        const stat = stats.get(f.path);
        const statStr = stat
          ? chalk.dim("  ") + chalk.green(`+${stat.added}`) + chalk.dim(" ") + chalk.red(`-${stat.deleted}`)
          : "";
        return {
          name: `${STATUS_LABEL[f.status] ?? chalk.dim("unknown  ")}  ${f.path}${statStr}`,
          value: f.path,
          checked: true,
        };
      }),
      validate: (choices: string[]) =>
        choices.length > 0 || "Select at least one file to stage.",
    } as any,
  ]);

  return selected as string[];
}

export async function promptCommit(hookFile?: string, amend = false): Promise<void> {
  setupEscapeHandler();

  await GitCleanSpellChecker.initialize();

  const config = loadConfig();
  const promptsConfig = config.prompts || {
    scope: true,
    body: false,
    breaking: false,
    issues: false,
  };

  // Parse last commit for amend pre-fill
  const lastCommit = amend ? parseConventionalCommit(getLastCommitMessage()) : null;

  // Suggest scope from branch name (e.g. feat/auth → "auth")
  const branchScope = getScopeFromBranch();

  try {
    // File selection — skip for hook mode and amend (staging is caller's responsibility)
    let selectedFiles: string[] = ["."];
    if (!hookFile && !amend) {
      selectedFiles = await promptFileSelection();
      if (selectedFiles.length === 0) {
        console.log(chalk.yellow("No files selected. Aborting."));
        process.exit(0);
      }
    }

    // Diff summary box — show after file selection, before prompts
    if (!hookFile && !amend) {
      const stats = getDiffNumstat();
      const changedFiles = getChangedFiles().filter(
        (f) => selectedFiles[0] === "." || selectedFiles.includes(f.path)
      );
      if (changedFiles.length > 0) {
        const lines = changedFiles.map((f) => {
          const stat = stats.get(f.path);
          const statStr = stat
            ? chalk.green(` +${stat.added}`) + chalk.dim("/") + chalk.red(`-${stat.deleted}`)
            : "";
          return `  ${STATUS_LABEL[f.status] ?? chalk.dim("unknown")}  ${f.path}${statStr}`;
        });
        console.log(
          boxen(lines.join("\n"), {
            padding: 0.5,
            margin: { top: 0, bottom: 1, left: 0, right: 0 },
            borderColor: "dim",
            borderStyle: "round",
            title: `${changedFiles.length} file${changedFiles.length !== 1 ? "s" : ""} staged`,
            titleAlignment: "center",
          })
        );
      }
    }

    // Step counter
    const totalSteps =
      1 +
      (promptsConfig.scope ? 1 : 0) +
      1 +
      (promptsConfig.body ? 1 : 0) +
      (promptsConfig.breaking ? 1 : 0) +
      (promptsConfig.issues ? 1 : 0);
    let step = 0;
    const s = () => chalk.dim(`[${++step}/${totalSteps}] `);

    // Recent scopes for autocomplete hint
    const recentScopes = getRecentScopes();
    const scopeHint = recentScopes.length > 0
      ? chalk.dim(` — recent: ${recentScopes.slice(0, 4).join(", ")}`)
      : "";

    // Build questions array based on config
    const questions: any[] = [
      {
        name: "type",
        type: "list",
        message: s() + (amend ? "Select new commit type:" : "Select commit type:"),
        choices: [
          ...getCommitTypes(),
          ...(amend ? [] : [new inquirer.Separator(), { name: chalk.magenta("Generate with AI"), value: "ai_generate" }]),
        ],
        default: lastCommit?.type ?? undefined,
        pageSize: 11,
        theme: { helpMode: "never" },
      },
    ];

    // Conditionally add scope prompt
    if (promptsConfig.scope) {
      questions.push({
        name: "scope",
        type: "input",
        message: s() + `Scope (optional)${scopeHint}:`,
        when: (a: any) => a.type !== "ai_generate",
        default: lastCommit?.scope || branchScope || undefined,
        filter: (input: string) => input.trim(),
      });
    }

    // Always add message prompt (required)
    questions.push({
      name: "message",
      type: "spellcheck" as any,
      message: s() + "Commit message:",
      default: lastCommit?.message ?? undefined,
      charLimit: 72,
      when: (a: any) => a.type !== "ai_generate",
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
        message: s() + "Longer description (optional):",
        when: (a: any) => a.type !== "ai_generate",
        filter: (input: string) => input.trim(),
      });
    }

    // Conditionally add breaking changes prompt
    if (promptsConfig.breaking) {
      questions.push({
        name: "breaking",
        type: "confirm",
        message: s() + "Are there any breaking changes?",
        when: (a: any) => a.type !== "ai_generate",
        default: false,
      });
    }

    // Conditionally add issues prompt
    if (promptsConfig.issues) {
      questions.push({
        name: "issues",
        type: "input",
        message: s() + 'Issue references (e.g., "fixes #123"):',
        when: (a: any) => a.type !== "ai_generate",
        filter: (input: string) => input.trim(),
      });
    }

    // Prompt user with configured questions
    let answers = await inquirer.prompt(questions);

    // If user selected AI generation from the list — same flow as `gitclean ai`
    if (answers.type === "ai_generate") {
      return runAiCommitFlow(hookFile);
    }

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
          if (amend) {
            await executeGitAmend(fullCommit);
          } else {
            await executeFullGitWorkflow(fullCommit, selectedFiles);
          }
        } catch (error) {
          console.error(
            boxen(chalk.red(`Failed to ${amend ? "amend" : "complete git workflow"}`), {
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
