import chalk from "chalk";
import { CommitType, CommitAnswers } from "../types/index.js";

export class FormatUtils {
  /**
   * Format commit message for display with colors and emojis
   */
  public static formatCommitMessage(
    type: CommitType,
    header: string,
    body?: string,
    breaking?: boolean,
    issues?: string
  ): string {
    const colorFn = this.getChalkColor(type.color);
    let message = `${type.emoji} ${colorFn(header)}`;

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

  /**
   * Get chalk color function safely
   */
  private static getChalkColor(color: string): (text: string) => string {
    switch (color) {
      case "red": return chalk.red;
      case "green": return chalk.green;
      case "yellow": return chalk.yellow;
      case "blue": return chalk.blue;
      case "magenta": return chalk.magenta;
      case "cyan": return chalk.cyan;
      case "white": return chalk.white;
      case "gray": return chalk.gray;
      case "redBright": return chalk.redBright;
      case "greenBright": return chalk.greenBright;
      case "yellowBright": return chalk.yellowBright;
      case "blueBright": return chalk.blueBright;
      case "magentaBright": return chalk.magentaBright;
      case "cyanBright": return chalk.cyanBright;
      case "whiteBright": return chalk.whiteBright;
      default: return chalk.white;
    }
  }

  /**
   * Build conventional commit header from answers
   */
  public static buildCommitHeader(answers: CommitAnswers): string {
    const breakingPrefix = answers.breaking ? "!" : "";
    const scope = answers.scope ? `(${answers.scope})` : "";
    return `${answers.type}${scope}${breakingPrefix}: ${answers.message}`;
  }

  /**
   * Build full commit message for git from answers
   */
  public static buildFullCommitMessage(answers: CommitAnswers): string {
    const header = this.buildCommitHeader(answers);
    let fullCommit = header;

    if (answers.body) {
      fullCommit += `\n\n${answers.body}`;
    }

    if (answers.breaking) {
      fullCommit += `\n\nBREAKING CHANGE: ${answers.message}`;
    }

    if (answers.issues) {
      fullCommit += `\n\n${answers.issues}`;
    }

    return fullCommit;
  }

  /**
   * Create display text with spell check highlights
   */
  public static createSpellCheckDisplayText(text: string, errors: Array<{
    word: string;
    position: { start: number; end: number };
  }>): string {
    if (errors.length === 0) {
      return text;
    }

    let result = text;

    // Sort errors by position (descending) to avoid index shifting
    const sortedErrors = errors.sort(
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

  /**
   * Create squiggly underline for spell check errors
   */
  public static createSquigglyUnderline(text: string, errors: Array<{
    word: string;
    position: { start: number; end: number };
  }>): string {
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

      // Create red text with underline using ANSI codes
      const squigglyWord = `\x1b[31m\x1b[4m${word}\x1b[0m`;
      result = beforeWord + squigglyWord + afterWord;
    }

    return result;
  }

  /**
   * Truncate text to specified length with ellipsis
   */
  public static truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  }

  /**
   * Capitalize first letter of a string
   */
  public static capitalize(text: string): string {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Convert commit type value to display format
   */
  public static formatCommitTypeChoice(type: CommitType): { name: string; value: string; short: string } {
    return {
      name: type.name,
      value: type.value,
      short: `${type.emoji} ${type.value}`,
    };
  }
}