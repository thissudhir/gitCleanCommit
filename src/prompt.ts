import inquirer from "inquirer";
import readline from "readline";
import chalk from "chalk";
import { GitCleanSpellChecker, SpellCheckResult } from "./spellcheck.js";
import {
  executeFullGitWorkflow,
  executeGitAdd,
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

// ─── Spell-check prompt ───────────────────────────────────────────────────────

class SpellCheckPrompt {
  constructor(question: any, readLine: any, answers: any) {
    this.question = question;
    this.rl = readLine;
    this.answers = answers;
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
  private escListener: ((chunk: Buffer) => void) | null = null;
  private spellCheckTimeout: NodeJS.Timeout | null = null;
  private previousLineCount: number = 1;

  run(): Promise<string> {
    return new Promise((resolve) => {
      this.done = resolve;
      this.render();
      this.setupKeyHandlers();
    });
  }

  private setupKeyHandlers(): void {
    this.keypressListener = async (str: string, key: any) => {
      if (!key) return;

      if (key.name === "return" || key.name === "enter") {
        this.cleanup();
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
        let result = this.currentText;
        if (this.question.filter) {
          result = await this.question.filter(this.currentText);
        }
        this.status = "answered";
        this.done(result);
        return;
      }

      if (key.name === "escape" || (key.name === "c" && key.ctrl)) {
        this.cleanup();
        handleEscapeKey();
        return;
      }

      // Tab: apply the top suggestion for the word at cursor
      if (key.name === "tab") {
        const err = this.spellErrors.find(
          e => this.cursorPosition > e.position.start && this.cursorPosition <= e.position.end
        );
        if (err?.suggestions.length) {
          const fix = err.suggestions[0];
          this.currentText =
            this.currentText.slice(0, err.position.start) +
            fix +
            this.currentText.slice(err.position.end);
          this.cursorPosition = err.position.start + fix.length;
          await this.performSpellCheck();
        }
        this.render();
        return;
      }

      if (key.name === "left") {
        if (this.cursorPosition > 0) { this.cursorPosition--; this.render(); }
        return;
      }
      if (key.name === "right") {
        if (this.cursorPosition < this.currentText.length) { this.cursorPosition++; this.render(); }
        return;
      }
      if (key.name === "home") { this.cursorPosition = 0; this.render(); return; }
      if (key.name === "end") { this.cursorPosition = this.currentText.length; this.render(); return; }

      if (key.name === "backspace") {
        if (this.cursorPosition > 0) {
          this.currentText =
            this.currentText.slice(0, this.cursorPosition - 1) +
            this.currentText.slice(this.cursorPosition);
          this.cursorPosition--;
        }
      } else if (str && str.length === 1 && !key.ctrl && !key.meta) {
        this.currentText =
          this.currentText.slice(0, this.cursorPosition) +
          str +
          this.currentText.slice(this.cursorPosition);
        this.cursorPosition++;
      }

      await this.performSpellCheck();
      this.render();
    };

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();

    this.escListener = (chunk: Buffer) => {
      if (chunk.length === 1 && chunk[0] === 0x1b) {
        this.cleanup();
        handleEscapeKey();
      }
    };
    process.stdin.on("data", this.escListener);
    process.stdin.on("keypress", this.keypressListener);
  }

  private cleanup(): void {
    if (this.spellCheckTimeout) { clearTimeout(this.spellCheckTimeout); this.spellCheckTimeout = null; }
    if (this.escListener) { process.stdin.removeListener("data", this.escListener); this.escListener = null; }
    if (this.keypressListener) { process.stdin.removeListener("keypress", this.keypressListener); this.keypressListener = null; }
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
  }

  private async performSpellCheck(): Promise<void> {
    if (this.spellCheckTimeout) { clearTimeout(this.spellCheckTimeout); this.spellCheckTimeout = null; }
    if (this.currentText.length === 0) { this.spellErrors = []; return; }
    this.spellCheckTimeout = setTimeout(async () => {
      try {
        this.spellErrors = await GitCleanSpellChecker.checkSpelling(this.currentText);
        if (this.status === "pending") this.render();
      } catch {
        this.spellErrors = [];
      }
    }, 150);
  }

  private render(): void {
    if (this.status === "answered") return;

    const terminalWidth = process.stdout.columns || 80;
    const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

    if (this.previousLineCount > 1) process.stdout.moveCursor(0, -(this.previousLineCount - 1));
    process.stdout.cursorTo(0);
    process.stdout.clearScreenDown();

    const questionText = this.question.message;
    const promptPrefix = `${chalk.cyan("?")} ${chalk.bold(questionText)} `;
    process.stdout.write(promptPrefix);
    process.stdout.write(this.createDisplayText());

    // Character counter — show "N left" when within 15 chars of limit for quicker scanning
    const charLimit: number | undefined = (this.question as any).charLimit;
    let counterText = "";
    if (charLimit) {
      const len = this.currentText.length;
      const remaining = charLimit - len;
      if (remaining < 0) {
        counterText = chalk.red(` ${Math.abs(remaining)} over`);
      } else if (remaining <= 15) {
        counterText = chalk.yellow(` ${remaining} left`);
      } else {
        counterText = chalk.dim(` ${len}/${charLimit}`);
      }
    }
    process.stdout.write(counterText);

    // Tab suggestion hint — on its own line to avoid pushing the counter off-screen
    const errAtCursor = this.spellErrors.find(
      e => this.cursorPosition > e.position.start && this.cursorPosition <= e.position.end
    );
    const tabHint = errAtCursor?.suggestions[0]
      ? chalk.dim(`  ⇥ ${errAtCursor.suggestions[0]}`)
      : "";

    if (tabHint) process.stdout.write("\n" + tabHint);

    const promptLen = stripAnsi(promptPrefix).length;
    const firstLineLen = promptLen + this.currentText.length + stripAnsi(counterText).length;
    const firstLineRows = Math.max(1, Math.ceil(firstLineLen / terminalWidth));
    const hintRows = tabHint ? 1 : 0;
    this.previousLineCount = firstLineRows + hintRows;

    const endAbsoluteRow = firstLineRows - 1 + hintRows;
    const cursorAbs = promptLen + this.cursorPosition;
    const cursorLine = Math.floor(cursorAbs / terminalWidth);
    const cursorCol  = cursorAbs % terminalWidth;

    const rowsToMoveUp = endAbsoluteRow - cursorLine;
    if (rowsToMoveUp > 0) process.stdout.moveCursor(0, -rowsToMoveUp);
    process.stdout.cursorTo(cursorCol);
  }

  private createDisplayText(): string {
    if (this.spellErrors.length === 0) return this.currentText;
    let result = this.currentText;
    const sortedErrors = [...this.spellErrors].sort((a, b) => b.position.start - a.position.start);
    for (const error of sortedErrors) {
      const { word, position } = error;
      result =
        result.substring(0, position.start) +
        chalk.red.underline(word) +
        result.substring(position.end);
    }
    return result;
  }
}

inquirer.registerPrompt("spellcheck", SpellCheckPrompt as any);

// ─── Escape handling ──────────────────────────────────────────────────────────

let _hookMode = false;

function handleEscapeKey(): void {
  console.log(
    boxen(
      chalk.yellow("Operation cancelled") + "\n\n" + chalk.dim("Run the command again when you're ready."),
      { padding: 0.5, margin: 1, borderColor: "yellow", borderStyle: "round", title: "Cancelled", titleAlignment: "center" }
    )
  );
  // Exit 1 in hook mode so git aborts cleanly instead of proceeding with an empty message.
  process.exit(_hookMode ? 1 : 0);
}

function setupEscapeHandler(): void {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.on("keypress", (_str: unknown, key: any) => {
    if (key?.name === "escape") handleEscapeKey();
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCommitMessage(
  type: CommitTypeConfig,
  header: string,
  body?: string,
  breaking?: boolean,
  issues?: string
): string {
  let message = `${((chalk as any)[type.color] as (text: string) => string)(header)}`;
  if (body) message += `\n\n${chalk.dim(body)}`;
  if (breaking) message += `\n\n${chalk.redBright("BREAKING CHANGE:")} ${chalk.redBright(header)}`;
  if (issues) message += `\n\n${chalk.blue(issues)}`;
  return message;
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
          checked: f.staged,
        };
      }),
      validate: (choices: string[]) => choices.length > 0 || "Select at least one file to stage.",
    } as any,
  ]);
  return selected as string[];
}

// Scope selection: list of recent/branch scopes + custom entry option.
async function promptScopeList(
  stepLabel: string,
  recentScopes: string[],
  branchScope: string | null,
  defaultScope?: string
): Promise<string> {
  const seen = new Set<string>();
  const scopes: string[] = [];
  for (const s of [defaultScope, branchScope, ...recentScopes]) {
    if (s && !seen.has(s)) { seen.add(s); scopes.push(s); }
  }

  const choices: any[] = [
    ...scopes.map(s => ({ name: chalk.cyan(s), value: s })),
    ...(scopes.length > 0 ? [new inquirer.Separator()] : []),
    { name: chalk.dim("(none)"), value: "" },
    { name: chalk.green("+ type a custom scope"), value: "__custom__" },
  ];

  const { scopeChoice } = await inquirer.prompt([{
    name: "scopeChoice",
    type: "list",
    message: stepLabel + "Scope (optional):",
    choices,
    default: defaultScope || branchScope || "",
    theme: { helpMode: "never" },
  }]);

  if (scopeChoice === "__custom__") {
    const { customScope } = await inquirer.prompt([{
      name: "customScope",
      type: "input",
      message: chalk.dim("  ↳ ") + "Enter scope:",
      filter: (v: string) => v.trim(),
    }]);
    return customScope;
  }

  return scopeChoice;
}

// ─── AI flow ──────────────────────────────────────────────────────────────────

export async function runAiCommitFlow(hookFile?: string): Promise<void> {
  if (hookFile) _hookMode = true;
  if (!hookFile) setupEscapeHandler();
  try {
    const selectedFiles = hookFile ? ["."] : await promptFileSelection();
    if (!hookFile && selectedFiles.length === 0) {
      console.log(chalk.yellow("No files selected. Aborting."));
      process.exit(0);
    }

    // Stage selected files so getStagedDiff() has content to work with.
    // Skip in hook mode — the user already staged files before running git commit.
    if (!hookFile) {
      executeGitAdd(selectedFiles);
    }

    let message = await AiGenerator.generateCommitMessage(selectedFiles);
    let messageSource: "ai" | "edited" = "ai";

    while (true) {
      const boxTitle = messageSource === "ai" ? "AI Suggestion" : "Your Edit";
      const msgLen = message.length;
      const lenColor = msgLen > 72 ? chalk.red : msgLen > 58 ? chalk.yellow : chalk.dim;
      const lenLabel = lenColor(`\n\n${msgLen}/72 chars`);
      const borderColor = msgLen > 72 ? "red" : "green";
      console.log(
        boxen(chalk.green("Commit Message:\n\n") + chalk.white(message) + lenLabel, {
          padding: 0.5, margin: 0.5, borderColor, borderStyle: "round",
          title: boxTitle, titleAlignment: "center",
        })
      );

      const { action } = await inquirer.prompt([{
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
      }]);

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
        messageSource = "edited";
      } else if (action === "regenerate") {
        message = await AiGenerator.generateCommitMessage(selectedFiles);
        messageSource = "ai";
      } else if (action === "regenerate_hint") {
        const { hint } = await inquirer.prompt([{
          name: "hint",
          type: "input",
          message: "Hint for AI (e.g. 'focus on the auth changes'):",
          validate: (v: string) => v.trim().length > 0 || "Enter a hint",
        }]);
        message = await AiGenerator.generateCommitMessage(selectedFiles, hint.trim());
        messageSource = "ai";
      } else {
        console.log(boxen(chalk.yellow("Operation cancelled"), {
          padding: 0.5, margin: 0.5, borderColor: "yellow", borderStyle: "round",
        }));
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

// ─── Main commit prompt ───────────────────────────────────────────────────────

export async function promptCommit(hookFile?: string, amend = false): Promise<void> {
  if (hookFile) _hookMode = true;

  // Hook-mode header (banner is suppressed by caller for hook mode)
  if (hookFile) {
    console.log(chalk.bold("◆ gitclean") + chalk.dim("  triggered by git commit\n"));
  }

  if (!amend) setupEscapeHandler();

  await GitCleanSpellChecker.initialize();

  const config = loadConfig();
  const promptsConfig = config.prompts || { scope: true, body: false, breaking: false, issues: false };
  const lastCommit = amend ? parseConventionalCommit(getLastCommitMessage()) : null;
  const branchScope = getScopeFromBranch();

  try {
    // File selection (skip for hook/amend — staging is caller's responsibility)
    let selectedFiles: string[] = ["."];
    if (!hookFile && !amend) {
      selectedFiles = await promptFileSelection();
      if (selectedFiles.length === 0) {
        console.log(chalk.yellow("No files selected. Aborting."));
        process.exit(0);
      }
    }

    // Diff summary box
    if (!hookFile && !amend) {
      const stats = getDiffNumstat();
      const changedFiles = getChangedFiles().filter(
        f => selectedFiles[0] === "." || selectedFiles.includes(f.path)
      );
      if (changedFiles.length > 0) {
        const lines = changedFiles.map(f => {
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

    // Show current commit message when amending so user knows what they're changing
    if (amend) {
      const currentMsg = getLastCommitMessage();
      if (currentMsg) {
        console.log(
          boxen(chalk.white(currentMsg), {
            padding: 0.5,
            margin: { top: 0, bottom: 1, left: 0, right: 0 },
            borderColor: "yellow",
            borderStyle: "round",
            title: "Amending",
            titleAlignment: "center",
          })
        );
      }
    }

    // Cancel hint — shown just before prompts begin
    console.log(chalk.dim("  esc · ctrl+c to cancel\n"));

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

    const recentScopes = getRecentScopes();

    // ── Step 1: Type (AI option at top) ────────────────────────────────────
    const { type } = await inquirer.prompt([{
      name: "type",
      type: "list",
      message: s() + (amend ? "Select new commit type:" : "Select commit type:"),
      choices: [
        ...(amend ? [] : [
          { name: chalk.magenta("✨ Generate with AI") + chalk.dim("  auto-generate from diff"), value: "ai_generate" },
          new inquirer.Separator(),
        ]),
        ...getCommitTypes(),
      ],
      default: lastCommit?.type ?? undefined,
      pageSize: 12,
      theme: { helpMode: "never" },
    }]);

    if (type === "ai_generate") {
      return runAiCommitFlow(hookFile);
    }

    // ── Step 2: Scope (list of recent + custom option) ──────────────────────
    let scope = "";
    if (promptsConfig.scope) {
      scope = await promptScopeList(s(), recentScopes, branchScope, lastCommit?.scope);
    }

    // ── Step 3+: Message, body, breaking changes, issues ───────────────────
    const remainingQuestions: any[] = [{
      name: "message",
      type: "spellcheck" as any,
      message: s() + "Commit message:",
      default: lastCommit?.message ?? undefined,
      charLimit: 72,
      validate: (input: string) => {
        if (input.trim().length < 1) return "Please enter a commit message.";
        if (input.trim().length > 72) return "Keep the first line under 72 characters.";
        return true;
      },
      filter: (input: string) => input.trim(),
    }];

    if (promptsConfig.body) {
      remainingQuestions.push({
        name: "body",
        type: "spellcheck" as any,
        message: s() + "Longer description (optional):",
        filter: (input: string) => input.trim(),
      });
    }

    if (promptsConfig.breaking) {
      remainingQuestions.push({
        name: "breaking",
        type: "confirm",
        message: s() + "Are there any breaking changes?",
        default: false,
      });
    }

    if (promptsConfig.issues) {
      remainingQuestions.push({
        name: "issues",
        type: "input",
        message: s() + 'Issue references (e.g., "fixes #123"):',
        filter: (input: string) => input.trim(),
      });
    }

    const answers = await inquirer.prompt(remainingQuestions);

    // ── Build commit message ────────────────────────────────────────────────
    const selectedType = getCommitTypeConfig(type);
    const breakingPrefix = answers.breaking ? "!" : "";
    const scopePart = scope ? `(${scope})` : "";
    const commitHeader = `${type}${scopePart}${breakingPrefix}: ${answers.message}`;

    // Show formatted summary
    console.log(
      boxen(formatCommitMessage(selectedType, commitHeader, answers.body, answers.breaking, answers.issues), {
        padding: 0.5,
        margin: 0.5,
        borderColor: selectedType.color,
        borderStyle: "round",
        title: "Final Commit Message",
        titleAlignment: "center",
      })
    );

    let fullCommit = commitHeader;
    if (answers.body) fullCommit += `\n\n${answers.body}`;
    if (answers.breaking) fullCommit += `\n\nBREAKING CHANGE: ${answers.message}`;
    if (answers.issues) fullCommit += `\n\n${answers.issues}`;

    // ── Commit (no confirmation prompt) ────────────────────────────────────
    if (hookFile) {
      writeFileSync(hookFile, fullCommit);
      console.log(
        boxen(chalk.green("Commit message created successfully!"), {
          padding: 0.5, margin: 0.5, borderColor: "green", borderStyle: "round",
        })
      );
    } else {
      try {
        if (amend) {
          await executeGitAmend(fullCommit);
        } else {
          await executeFullGitWorkflow(fullCommit, selectedFiles);
        }
      } catch {
        console.error(
          boxen(chalk.red(`Failed to ${amend ? "amend" : "complete git workflow"}`), {
            padding: 0.5, margin: 0.5, borderColor: "red", borderStyle: "round",
          })
        );
        process.exit(1);
      }
    }
  } catch (error) {
    if (error && typeof error === "object" && "name" in error) {
      if ((error as any).name === "ExitPromptError") handleEscapeKey();
    }
    throw error;
  } finally {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  }
}
