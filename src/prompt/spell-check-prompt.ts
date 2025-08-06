import chalk from "chalk";
import { SpellCheckResult } from "../types/index.js";
import { GitCleanSpellChecker } from "../spellcheck.js";
import { FormatUtils } from "../utils/format-utils.js";
import { ConfigManager } from "../config/config-manager.js";

export interface PromptQuestion {
  message: string;
  validate?: (input: string) => Promise<string | boolean> | string | boolean;
  filter?: (input: string) => Promise<string> | string;
}

export class SpellCheckPrompt {
  private question: PromptQuestion;
  private rl: any;
  private answers: any;
  private currentText: string;
  private spellErrors: SpellCheckResult[];
  private status: string;
  private done!: (value: string) => void;
  private keypressListener: any;
  private spellCheckTimeout: any;

  constructor(question: PromptQuestion, readLine: any, answers: any) {
    this.question = question;
    this.rl = readLine;
    this.answers = answers;
    this.currentText = "";
    this.spellErrors = [];
    this.status = "pending";
    this.keypressListener = null;
  }

  public run(): Promise<string> {
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
        await this.handleEnterKey();
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

  private async handleEnterKey(): Promise<void> {
    this.cleanup();

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
  }

  private cleanup(): void {
    if (this.keypressListener) {
      process.stdin.removeListener("keypress", this.keypressListener);
      this.keypressListener = null;
    }
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    if (this.spellCheckTimeout) {
      clearTimeout(this.spellCheckTimeout);
    }
  }

  private async performSpellCheck(): Promise<void> {
    if (this.currentText.length === 0) {
      this.spellErrors = [];
      return;
    }

    const config = ConfigManager.loadConfig();
    const debounceMs = config.spellCheck?.debounceMs || 200;

    clearTimeout(this.spellCheckTimeout);
    this.spellCheckTimeout = setTimeout(async () => {
      try {
        this.spellErrors = await GitCleanSpellChecker.checkSpelling(
          this.currentText
        );
        this.render();
      } catch (error) {
        // Silent error handling for spell check
        this.spellErrors = [];
      }
    }, debounceMs);
  }

  private render(): void {
    if (this.status === "answered") return;

    // Clear current line
    process.stdout.write("\r\x1b[K");

    // Show question
    const questionText = this.question.message;
    process.stdout.write(`${chalk.cyan("?")} ${chalk.bold(questionText)} `);

    // Show text with spell checking
    const displayText = FormatUtils.createSpellCheckDisplayText(
      this.currentText,
      this.spellErrors
    );
    process.stdout.write(displayText);
  }
}