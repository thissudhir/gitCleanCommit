import chalk from "chalk";
import boxen from "boxen";
import { GitCleanError, SpellCheckError, GitOperationError, ConfigurationError } from "../types/index.js";

export class ErrorHandler {
  /**
   * Safely extract error message from unknown error type
   */
  public static getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  /**
   * Handle and display errors with appropriate formatting
   */
  public static handleError(error: unknown, context?: string): void {
    let errorMessage: string;
    let errorType: string;
    let suggestions: string[] = [];

    if (error instanceof GitCleanError) {
      errorType = this.getErrorTypeName(error);
      errorMessage = error.message;
      suggestions = this.getErrorSuggestions(error);
    } else {
      errorType = "Unexpected Error";
      errorMessage = this.getErrorMessage(error);
    }

    const contextPrefix = context ? `${context}: ` : "";
    const fullMessage = `${contextPrefix}${errorMessage}`;

    // Display formatted error
    this.displayError(errorType, fullMessage, suggestions);
  }

  /**
   * Display error with suggestions in a formatted box
   */
  private static displayError(type: string, message: string, suggestions: string[] = []): void {
    let content = chalk.red(`❌ ${type}\n\n`) + chalk.dim(message);

    if (suggestions.length > 0) {
      content += "\n\n" + chalk.yellow("💡 Suggestions:");
      suggestions.forEach(suggestion => {
        content += "\n" + chalk.dim(`• ${suggestion}`);
      });
    }

    console.error(
      boxen(content, {
        padding: 0.5,
        margin: 0.5,
        borderColor: "red",
        borderStyle: "round",
        title: "Error",
        titleAlignment: "center",
      })
    );
  }

  /**
   * Get human-readable error type name
   */
  private static getErrorTypeName(error: GitCleanError): string {
    switch (error.constructor) {
      case SpellCheckError:
        return "Spell Check Error";
      case GitOperationError:
        return "Git Operation Error";
      case ConfigurationError:
        return "Configuration Error";
      default:
        return "GitClean Error";
    }
  }

  /**
   * Get contextual suggestions based on error type and message
   */
  private static getErrorSuggestions(error: GitCleanError): string[] {
    const suggestions: string[] = [];

    if (error instanceof GitOperationError) {
      if (error.message.includes("not a git repository")) {
        suggestions.push("Initialize a git repository with 'git init'");
        suggestions.push("Make sure you're in the correct directory");
      } else if (error.message.includes("remote")) {
        suggestions.push("Add a remote repository with 'git remote add origin <url>'");
        suggestions.push("Check existing remotes with 'git remote -v'");
      } else if (error.message.includes("push")) {
        suggestions.push("Check your internet connection");
        suggestions.push("Verify you have push permissions to the repository");
        suggestions.push("Try manually pushing with 'git push origin <branch>'");
      } else if (error.message.includes("commit")) {
        suggestions.push("Make sure you have changes to commit");
        suggestions.push("Check git status with 'gitclean status'");
      }
    }

    if (error instanceof SpellCheckError) {
      suggestions.push("Try running 'gitclean test' to verify spell checker");
      suggestions.push("Check if custom dictionary words are properly configured");
    }

    if (error instanceof ConfigurationError) {
      suggestions.push("Check the syntax of your .gitclean.json file");
      suggestions.push("Run 'gitclean config init' to create a default configuration");
      suggestions.push("Remove .gitclean.json to use default settings");
    }

    return suggestions;
  }

  /**
   * Create a warning message
   */
  public static showWarning(message: string, suggestions: string[] = []): void {
    let content = chalk.yellow(`⚠️ Warning\n\n`) + chalk.dim(message);

    if (suggestions.length > 0) {
      content += "\n\n" + chalk.blue("💡 Suggestions:");
      suggestions.forEach(suggestion => {
        content += "\n" + chalk.dim(`• ${suggestion}`);
      });
    }

    console.warn(
      boxen(content, {
        padding: 0.5,
        margin: 0.5,
        borderColor: "yellow",
        borderStyle: "round",
        title: "Warning",
        titleAlignment: "center",
      })
    );
  }

  /**
   * Create a success message
   */
  public static showSuccess(message: string, details?: string[]): void {
    let content = chalk.green(`✅ Success\n\n`) + chalk.dim(message);

    if (details && details.length > 0) {
      content += "\n\n" + chalk.blue("📋 Details:");
      details.forEach(detail => {
        content += "\n" + chalk.dim(`• ${detail}`);
      });
    }

    console.log(
      boxen(content, {
        padding: 0.5,
        margin: 0.5,
        borderColor: "green",
        borderStyle: "round",
        title: "Success",
        titleAlignment: "center",
      })
    );
  }
}