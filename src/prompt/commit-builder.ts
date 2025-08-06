import inquirer from "inquirer";
import chalk from "chalk";
import boxen from "boxen";
import { CommitType, CommitAnswers, WorkflowOptions } from "../types/index.js";
import { ConfigManager } from "../config/config-manager.js";
import { FormatUtils } from "../utils/format-utils.js";
import { GitCleanSpellChecker } from "../spellcheck.js";
import { SpellCheckPrompt } from "./spell-check-prompt.js";
import { executeFullGitWorkflow } from "../git-integration.js";
import { ErrorHandler } from "../utils/error-handler.js";
import { TemplateManager } from "../templates/template-manager.js";
import { writeFileSync } from "fs";

// Register custom prompt type
inquirer.registerPrompt("spellcheck", SpellCheckPrompt as any);

export class CommitBuilder {
  private config = ConfigManager.loadConfig();

  public async buildCommit(options: WorkflowOptions = {}): Promise<void> {
    this.setupEscapeHandler();

    // Initialize spell checker
    await GitCleanSpellChecker.initialize();

    if (this.config.spellCheck?.enabled) {
      console.log(
        chalk.blue("🔤 Real-time spell checking enabled for text inputs!\n")
      );
    }

    try {
      const answers = await this.collectCommitAnswers();
      const selectedType = this.findCommitType(answers.type);
      
      if (!selectedType) {
        throw new Error(`Invalid commit type: ${answers.type}`);
      }

      const { formattedCommit, fullCommit } = this.formatCommitMessages(
        selectedType,
        answers
      );

      this.displayCommitPreview(formattedCommit, selectedType.color);

      const confirmed = await this.confirmCommit();
      
      if (confirmed) {
        await this.executeCommit(fullCommit, answers, options);
      } else {
        this.showCancellation();
      }
    } catch (error) {
      if (this.isExitError(error)) {
        this.handleEscapeKey();
      } else {
        throw error;
      }
    } finally {
      this.cleanup();
    }
  }

  private async collectCommitAnswers(): Promise<CommitAnswers> {
    const commitTypes = this.config.commitTypes || [];
    const templates = TemplateManager.getTemplates();
    
    // Check if user wants to use a template
    if (templates.length > 0) {
      const { useTemplate } = await inquirer.prompt([
        {
          name: "useTemplate",
          type: "confirm",
          message: "Would you like to use a commit template?",
          default: false,
        },
      ]);

      if (useTemplate) {
        const { templateName } = await inquirer.prompt([
          {
            name: "templateName",
            type: "list",
            message: "Select a template:",
            choices: [
              { name: "None - Continue manually", value: null },
              ...TemplateManager.getTemplateChoices(),
            ],
          },
        ]);

        if (templateName) {
          const templateAnswers = TemplateManager.applyTemplate(templateName);
          
          // Allow user to customize the template
          const { customize } = await inquirer.prompt([
            {
              name: "customize",
              type: "confirm",
              message: "Would you like to customize this template?",
              default: false,
            },
          ]);

          if (customize) {
            return await this.customizeTemplateAnswers(templateAnswers);
          } else {
            return templateAnswers;
          }
        }
      }
    }
    
    return await inquirer.prompt([
      {
        name: "type",
        type: "list",
        message: "Select the type of change you're committing:",
        choices: commitTypes.map(FormatUtils.formatCommitTypeChoice),
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
        type: this.config.spellCheck?.enabled ? ("spellcheck" as any) : "input",
        message: "Write a short, commit message:",
        validate: this.validateCommitMessage,
        filter: (input: string) => input.trim(),
      },
      {
        name: "body",
        type: this.config.spellCheck?.enabled ? ("spellcheck" as any) : "input",
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
  }

  private async customizeTemplateAnswers(templateAnswers: CommitAnswers): Promise<CommitAnswers> {
    console.log(chalk.blue("\n🎨 Customizing template..."));
    
    return await inquirer.prompt([
      {
        name: "scope",
        type: "input",
        message: "What is the scope of this change? (optional):",
        default: templateAnswers.scope,
        filter: (input: string) => input.trim(),
      },
      {
        name: "message",
        type: this.config.spellCheck?.enabled ? ("spellcheck" as any) : "input",
        message: "Commit message:",
        default: templateAnswers.message,
        validate: this.validateCommitMessage,
        filter: (input: string) => input.trim(),
      },
      {
        name: "body",
        type: this.config.spellCheck?.enabled ? ("spellcheck" as any) : "input",
        message: "Extended description (optional):",
        default: templateAnswers.body,
        filter: (input: string) => input.trim(),
      },
      {
        name: "breaking",
        type: "confirm",
        message: "Are there any breaking changes?",
        default: templateAnswers.breaking,
      },
      {
        name: "issues",
        type: "input",
        message: 'Add issue references (e.g., "fixes #123", "closes #456"):',
        default: templateAnswers.issues,
        filter: (input: string) => input.trim(),
      },
    ]).then(answers => ({
      ...templateAnswers,
      ...answers,
    }));
  }

  private validateCommitMessage(input: string): string | boolean {
    if (input.trim().length < 1) {
      return "Please enter a commit message.";
    }
    if (input.trim().length > 72) {
      return "Keep the first line under 72 characters.";
    }
    return true;
  }

  private findCommitType(typeValue: string): CommitType | undefined {
    return (this.config.commitTypes || []).find(type => type.value === typeValue);
  }

  private formatCommitMessages(type: CommitType, answers: CommitAnswers): {
    formattedCommit: string;
    fullCommit: string;
  } {
    const commitHeader = FormatUtils.buildCommitHeader(answers);
    const formattedCommit = FormatUtils.formatCommitMessage(
      type,
      commitHeader,
      answers.body,
      answers.breaking,
      answers.issues
    );
    const fullCommit = FormatUtils.buildFullCommitMessage(answers);

    return { formattedCommit, fullCommit };
  }

  private displayCommitPreview(formattedCommit: string, borderColor: string): void {
    console.log(
      boxen(formattedCommit, {
        padding: 0.5,
        margin: 0.5,
        borderColor: borderColor as any,
        borderStyle: "round",
        title: "Final Commit Message",
        titleAlignment: "center",
      })
    );
  }

  private async confirmCommit(): Promise<boolean> {
    const { confirm } = await inquirer.prompt([
      {
        name: "confirm",
        type: "confirm",
        message: "Ready to commit?",
        default: true,
      },
    ]);
    return confirm;
  }

  private async executeCommit(
    fullCommit: string,
    answers: CommitAnswers,
    options: WorkflowOptions
  ): Promise<void> {
    if (options.hookFile) {
      writeFileSync(options.hookFile, fullCommit);
      ErrorHandler.showSuccess("Commit message created successfully!");
    } else {
      try {
        const config = ConfigManager.loadConfig();
        const files = config.workflow?.addFiles || ["."];
        await executeFullGitWorkflow(
          FormatUtils.buildCommitHeader(answers),
          answers.body,
          files
        );
      } catch (error) {
        ErrorHandler.handleError(error, "Failed to complete git workflow");
        process.exit(1);
      }
    }
  }

  private showCancellation(): void {
    console.log(
      boxen(chalk.yellow("❌ Operation cancelled"), {
        padding: 0.5,
        margin: 0.5,
        borderColor: "yellow",
        borderStyle: "round",
      })
    );
    process.exit(1);
  }

  private setupEscapeHandler(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      process.stdin.on("data", (key: Buffer | string) => {
        const keyString = key.toString();
        if (keyString === "\u001B" || keyString === "\u0003") {
          this.handleEscapeKey();
        }
      });
    }
  }

  private handleEscapeKey(): void {
    const exitBox = boxen(
      chalk.yellow("⚠️  Operation cancelled by user (ESC pressed)") +
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

  private isExitError(error: any): boolean {
    return error && typeof error === "object" && "name" in error && error.name === "ExitPromptError";
  }

  private cleanup(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  }
}