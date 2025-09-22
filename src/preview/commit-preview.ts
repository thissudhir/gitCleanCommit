import { CommitAnswers } from "../types/index.js";
import { FormatUtils } from "../utils/format-utils.js";
import chalk from "chalk";
import boxen from "boxen";

export interface PreviewOptions {
  format: 'standard' | 'github' | 'gitlab' | 'conventional' | 'detailed';
  showStats?: boolean;
  showDiff?: boolean;
  includeEmoji?: boolean;
  maxWidth?: number;
}

export interface CommitStats {
  filesChanged: number;
  insertions: number;
  deletions: number;
  totalLines: number;
}

export class CommitPreview {
  private static readonly EMOJI_MAP: Record<string, string> = {
    feat: '✨',
    fix: '🐛',
    docs: '📚',
    style: '💎',
    refactor: '♻️',
    test: '🧪',
    chore: '🔧',
    build: '📦',
    ci: '🤖',
    perf: '⚡',
    revert: '⏪'
  };

  private static readonly PLATFORM_FORMATS = {
    github: {
      title: (subject: string) => `**${subject}**`,
      breaking: '🚨 **BREAKING CHANGE**',
      issues: (issues: string) => `Fixes #${issues.replace(/[#,]/g, ' #').trim()}`
    },
    gitlab: {
      title: (subject: string) => `**${subject}**`,
      breaking: '🚨 **BREAKING CHANGE**',
      issues: (issues: string) => `Closes #${issues.replace(/[#,]/g, ' #').trim()}`
    },
    conventional: {
      title: (subject: string) => subject,
      breaking: 'BREAKING CHANGE:',
      issues: (issues: string) => `Fixes: ${issues}`
    }
  };

  public static generatePreview(
    answers: CommitAnswers,
    options: PreviewOptions = { format: 'standard' }
  ): string {
    const { type, scope, message, body, breaking, issues } = answers;

    switch (options.format) {
      case 'github':
      case 'gitlab':
        return this.generatePlatformPreview(answers, options);
      case 'conventional':
        return this.generateConventionalPreview(answers, options);
      case 'detailed':
        return this.generateDetailedPreview(answers, options);
      default:
        return this.generateStandardPreview(answers, options);
    }
  }

  private static generateStandardPreview(
    answers: CommitAnswers,
    options: PreviewOptions
  ): string {
    const { type, scope, message, body, breaking, issues } = answers;
    const emoji = options.includeEmoji ? this.EMOJI_MAP[type] || '' : '';

    let preview = '';

    // Subject line
    const scopeText = scope ? `(${scope})` : '';
    const subjectLine = `${type}${scopeText}: ${emoji ? emoji + ' ' : ''}${message}`;
    preview += subjectLine;

    // Body
    if (body) {
      preview += '\n\n' + body;
    }

    // Breaking changes
    if (breaking) {
      preview += '\n\nBREAKING CHANGE: ' + body;
    }

    // Issues
    if (issues) {
      preview += '\n\nCloses: ' + issues;
    }

    return preview;
  }

  private static generatePlatformPreview(
    answers: CommitAnswers,
    options: PreviewOptions
  ): string {
    const { type, scope, message, body, breaking, issues } = answers;
    const platform = options.format as 'github' | 'gitlab';
    const format = this.PLATFORM_FORMATS[platform];
    const emoji = options.includeEmoji ? this.EMOJI_MAP[type] || '' : '';

    let preview = '';

    // Title
    const scopeText = scope ? ` (${scope})` : '';
    const title = `${type}${scopeText}: ${emoji ? emoji + ' ' : ''}${message}`;
    preview += format.title(title);

    // Body
    if (body) {
      preview += '\n\n' + body;
    }

    // Breaking changes
    if (breaking) {
      preview += '\n\n' + format.breaking + '\n' + body;
    }

    // Issues
    if (issues) {
      preview += '\n\n' + format.issues(issues);
    }

    return preview;
  }

  private static generateConventionalPreview(
    answers: CommitAnswers,
    options: PreviewOptions
  ): string {
    const { type, scope, message, body, breaking, issues } = answers;

    let preview = '';

    // Subject line (strict conventional format)
    const scopeText = scope ? `(${scope})` : '';
    const breakingPrefix = breaking ? '!' : '';
    preview += `${type}${scopeText}${breakingPrefix}: ${message}`;

    // Body
    if (body) {
      preview += '\n\n' + body;
    }

    // Breaking changes (footer format)
    if (breaking) {
      preview += '\n\nBREAKING CHANGE: ' + body;
    }

    // Issues (footer format)
    if (issues) {
      const issueNumbers = issues.split(/[,\s]+/).filter(Boolean);
      for (const issue of issueNumbers) {
        const cleanIssue = issue.replace('#', '');
        preview += `\nFixes #${cleanIssue}`;
      }
    }

    return preview;
  }

  private static generateDetailedPreview(
    answers: CommitAnswers,
    options: PreviewOptions
  ): string {
    const { type, scope, message, body, breaking, issues } = answers;
    const emoji = this.EMOJI_MAP[type] || '';

    let preview = '';

    // Header with metadata
    preview += chalk.dim('═'.repeat(50)) + '\n';
    preview += chalk.blue.bold(`${emoji} ${type.toUpperCase()}`) +
               (scope ? chalk.dim(` • ${scope}`) : '') + '\n';
    preview += chalk.dim('═'.repeat(50)) + '\n\n';

    // Subject
    preview += chalk.yellow.bold('Subject:\n');
    preview += chalk.white(message) + '\n\n';

    // Body
    if (body) {
      preview += chalk.yellow.bold('Description:\n');
      preview += chalk.dim(body) + '\n\n';
    }

    // Breaking changes
    if (breaking) {
      preview += chalk.red.bold('⚠️  BREAKING CHANGE:\n');
      preview += chalk.yellow(body) + '\n\n';
    }

    // Issues
    if (issues) {
      preview += chalk.green.bold('🔗 Related Issues:\n');
      preview += chalk.cyan(issues) + '\n\n';
    }

    // Commit formats
    preview += chalk.blue.bold('📝 Commit Formats:\n');
    preview += chalk.dim('Standard:      ') + this.generateStandardPreview(answers, { format: 'standard' }) + '\n';
    preview += chalk.dim('Conventional:  ') + this.generateConventionalPreview(answers, { format: 'conventional' }) + '\n\n';

    preview += chalk.dim('═'.repeat(50));

    return preview;
  }

  public static async getCommitStats(): Promise<CommitStats | null> {
    try {
      const { execSync } = await import("child_process");

      // Get staged files diff stats
      const diffOutput = execSync("git diff --cached --numstat", { encoding: "utf8" });

      if (!diffOutput.trim()) {
        return null;
      }

      const lines = diffOutput.trim().split('\n');
      let totalInsertions = 0;
      let totalDeletions = 0;
      let filesChanged = 0;

      for (const line of lines) {
        const [insertions, deletions] = line.split('\t');

        // Handle binary files (marked with -)
        if (insertions !== '-' && deletions !== '-') {
          totalInsertions += parseInt(insertions) || 0;
          totalDeletions += parseInt(deletions) || 0;
        }
        filesChanged++;
      }

      return {
        filesChanged,
        insertions: totalInsertions,
        deletions: totalDeletions,
        totalLines: totalInsertions + totalDeletions
      };
    } catch (error) {
      return null;
    }
  }

  public static async displayInteractivePreview(
    answers: CommitAnswers,
    options: PreviewOptions = { format: 'standard' }
  ): Promise<void> {
    const preview = this.generatePreview(answers, options);

    // Get commit stats if requested
    let stats: CommitStats | null = null;
    if (options.showStats) {
      stats = await this.getCommitStats();
    }

    // Create the preview box
    let content = '';

    // Add stats if available
    if (stats) {
      content += chalk.blue.bold('📊 Changes Summary\n');
      content += chalk.dim(`Files changed: ${stats.filesChanged}\n`);
      content += chalk.green(`Insertions: +${stats.insertions}\n`);
      content += chalk.red(`Deletions: -${stats.deletions}\n`);
      content += chalk.dim(`Total lines: ${stats.totalLines}\n\n`);
    }

    // Add commit preview
    content += chalk.yellow.bold('📝 Commit Message Preview\n');
    content += chalk.dim('─'.repeat(40)) + '\n';
    content += preview + '\n';
    content += chalk.dim('─'.repeat(40)) + '\n\n';

    // Add format information
    content += chalk.blue.bold(`Format: ${options.format}\n`);
    if (options.includeEmoji) {
      content += chalk.dim('✨ Emojis enabled\n');
    }

    console.log(
      boxen(content, {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "blue",
        title: "Commit Preview",
        titleAlignment: "center"
      })
    );
  }

  public static validateCommitMessage(message: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check length
    if (message.length === 0) {
      errors.push('Commit message cannot be empty');
    } else if (message.length < 10) {
      warnings.push('Commit message is very short (< 10 characters)');
      suggestions.push('Add more details to describe the change');
    } else if (message.length > 72) {
      warnings.push('Subject line is longer than 72 characters');
      suggestions.push('Keep the subject line under 72 characters');
    }

    // Check for conventional format
    const conventionalRegex = /^(\w+)(\(.+\))?: .+/;
    if (!conventionalRegex.test(message)) {
      warnings.push('Message does not follow conventional commit format');
      suggestions.push('Use format: type(scope): description');
    }

    // Check for proper capitalization
    const [firstLine] = message.split('\n');
    const subjectPart = firstLine.split(': ')[1];
    if (subjectPart && /^[A-Z]/.test(subjectPart)) {
      warnings.push('Subject should start with lowercase letter');
      suggestions.push('Use lowercase for the first letter after the colon');
    }

    // Check for ending punctuation
    if (firstLine.endsWith('.')) {
      warnings.push('Subject line should not end with a period');
      suggestions.push('Remove the period from the end of the subject line');
    }

    // Check for imperative mood indicators
    const imperativeBad = ['added', 'fixed', 'changed', 'updated', 'removed'];
    const subjectWords = subjectPart?.toLowerCase().split(' ') || [];
    const hasNonImperative = imperativeBad.some(word =>
      subjectWords.includes(word)
    );

    if (hasNonImperative) {
      suggestions.push('Use imperative mood (add, fix, change instead of added, fixed, changed)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  public static displayValidationResult(validation: ReturnType<typeof CommitPreview.validateCommitMessage>): void {
    if (validation.isValid && validation.warnings.length === 0) {
      console.log(chalk.green('✅ Commit message looks good!'));
      return;
    }

    let output = '';

    if (validation.errors.length > 0) {
      output += chalk.red.bold('❌ Errors:\n');
      validation.errors.forEach(error => {
        output += chalk.red(`  • ${error}\n`);
      });
      output += '\n';
    }

    if (validation.warnings.length > 0) {
      output += chalk.yellow.bold('⚠️  Warnings:\n');
      validation.warnings.forEach(warning => {
        output += chalk.yellow(`  • ${warning}\n`);
      });
      output += '\n';
    }

    if (validation.suggestions.length > 0) {
      output += chalk.blue.bold('💡 Suggestions:\n');
      validation.suggestions.forEach(suggestion => {
        output += chalk.cyan(`  • ${suggestion}\n`);
      });
    }

    console.log(
      boxen(output.trim(), {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: validation.errors.length > 0 ? "red" : "yellow",
        title: "Commit Message Validation",
        titleAlignment: "center"
      })
    );
  }

  public static async showDiffPreview(): Promise<void> {
    try {
      const { execSync } = await import("child_process");

      const diffOutput = execSync("git diff --cached --color=always", { encoding: "utf8" });

      if (!diffOutput.trim()) {
        console.log(chalk.yellow('No staged changes to preview'));
        return;
      }

      console.log(
        boxen(
          chalk.blue.bold('📋 Staged Changes\n\n') + diffOutput,
          {
            padding: 1,
            margin: 1,
            borderStyle: "round",
            borderColor: "blue",
            title: "Git Diff Preview",
            titleAlignment: "center"
          }
        )
      );
    } catch (error) {
      console.log(chalk.red('Failed to get diff preview'));
    }
  }
}