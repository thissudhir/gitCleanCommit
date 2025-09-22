import { execSync } from "child_process";
import { GitOperationError } from "../types/index.js";
import { FormatUtils } from "../utils/format-utils.js";
import chalk from "chalk";
import boxen from "boxen";

export interface CommitHistoryItem {
  hash: string;
  type: string;
  scope?: string;
  message: string;
  date: Date;
  author: string;
  filesChanged: number;
}

export interface CommitAnalytics {
  totalCommits: number;
  commitsByType: Record<string, number>;
  commitsByScope: Record<string, number>;
  commitsByAuthor: Record<string, number>;
  averageCommitsPerDay: number;
  mostActiveDay: string;
  commitTrends: {
    thisWeek: number;
    lastWeek: number;
    thisMonth: number;
    lastMonth: number;
  };
  suggestions: string[];
}

export class CommitAnalyticsManager {
  private static parseConventionalCommit(message: string): { type: string; scope?: string; subject: string } {
    // Parse conventional commit format: type(scope): subject
    const conventionalRegex = /^(\w+)(?:\(([^)]+)\))?: (.+)$/;
    const match = message.match(conventionalRegex);

    if (match) {
      return {
        type: match[1],
        scope: match[2],
        subject: match[3]
      };
    }

    // Fallback: try to detect type from common patterns
    const typePatterns = {
      feat: /^(add|implement|create|new)/i,
      fix: /^(fix|resolve|correct|patch)/i,
      docs: /^(doc|readme|documentation)/i,
      style: /^(style|format|lint)/i,
      refactor: /^(refactor|restructure|reorganize)/i,
      test: /^(test|spec)/i,
      chore: /^(chore|update|bump|merge)/i
    };

    for (const [type, pattern] of Object.entries(typePatterns)) {
      if (pattern.test(message)) {
        return { type, subject: message };
      }
    }

    return { type: 'other', subject: message };
  }

  public static async getCommitHistory(limit: number = 100): Promise<CommitHistoryItem[]> {
    try {
      // Get git log with detailed information
      const gitLog = execSync(
        `git log --oneline --pretty=format:"%H|%an|%ad|%s|" --date=iso --stat=1,1 -${limit}`,
        { encoding: "utf8" }
      );

      const commits: CommitHistoryItem[] = [];
      const lines = gitLog.trim().split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('|')) {
          const [hash, author, date, message] = line.split('|');

          // Get files changed for this commit
          let filesChanged = 0;
          try {
            const statOutput = execSync(`git show --stat=1,1 ${hash} | tail -1`, { encoding: "utf8" });
            const fileMatch = statOutput.match(/(\d+) files? changed/);
            filesChanged = fileMatch ? parseInt(fileMatch[1]) : 1;
          } catch {
            filesChanged = 1; // Default if we can't get stats
          }

          const parsed = this.parseConventionalCommit(message);

          commits.push({
            hash: hash.substring(0, 8),
            type: parsed.type,
            scope: parsed.scope,
            message: parsed.subject,
            date: new Date(date),
            author,
            filesChanged
          });
        }
      }

      return commits;
    } catch (error) {
      throw new GitOperationError(
        "Failed to retrieve commit history",
        error instanceof Error ? error : undefined
      );
    }
  }

  public static generateAnalytics(commits: CommitHistoryItem[]): CommitAnalytics {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Group commits by type
    const commitsByType: Record<string, number> = {};
    const commitsByScope: Record<string, number> = {};
    const commitsByAuthor: Record<string, number> = {};
    const commitsByDay: Record<string, number> = {};

    let thisWeekCommits = 0;
    let lastWeekCommits = 0;
    let thisMonthCommits = 0;
    let lastMonthCommits = 0;

    commits.forEach(commit => {
      // Count by type
      commitsByType[commit.type] = (commitsByType[commit.type] || 0) + 1;

      // Count by scope
      if (commit.scope) {
        commitsByScope[commit.scope] = (commitsByScope[commit.scope] || 0) + 1;
      }

      // Count by author
      commitsByAuthor[commit.author] = (commitsByAuthor[commit.author] || 0) + 1;

      // Count by day
      const dayKey = commit.date.toDateString();
      commitsByDay[dayKey] = (commitsByDay[dayKey] || 0) + 1;

      // Count time periods
      if (commit.date >= oneWeekAgo) thisWeekCommits++;
      if (commit.date >= twoWeeksAgo && commit.date < oneWeekAgo) lastWeekCommits++;
      if (commit.date >= oneMonthAgo) thisMonthCommits++;
      if (commit.date >= twoMonthsAgo && commit.date < oneMonthAgo) lastMonthCommits++;
    });

    // Find most active day
    const mostActiveDay = Object.entries(commitsByDay)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || "No commits";

    // Calculate average commits per day
    const oldestCommit = commits[commits.length - 1];
    const daysSinceOldest = oldestCommit
      ? Math.max(1, Math.ceil((now.getTime() - oldestCommit.date.getTime()) / (24 * 60 * 60 * 1000)))
      : 1;
    const averageCommitsPerDay = commits.length / daysSinceOldest;

    // Generate suggestions
    const suggestions = this.generateSuggestions(commits, {
      commitsByType,
      commitsByScope,
      thisWeekCommits,
      lastWeekCommits
    });

    return {
      totalCommits: commits.length,
      commitsByType,
      commitsByScope,
      commitsByAuthor,
      averageCommitsPerDay,
      mostActiveDay,
      commitTrends: {
        thisWeek: thisWeekCommits,
        lastWeek: lastWeekCommits,
        thisMonth: thisMonthCommits,
        lastMonth: lastMonthCommits
      },
      suggestions
    };
  }

  private static generateSuggestions(
    commits: CommitHistoryItem[],
    analytics: {
      commitsByType: Record<string, number>;
      commitsByScope: Record<string, number>;
      thisWeekCommits: number;
      lastWeekCommits: number;
    }
  ): string[] {
    const suggestions: string[] = [];

    // Analyze commit type patterns
    const totalCommits = commits.length;
    const featCount = analytics.commitsByType.feat || 0;
    const fixCount = analytics.commitsByType.fix || 0;
    const testCount = analytics.commitsByType.test || 0;
    const docsCount = analytics.commitsByType.docs || 0;

    if (featCount / totalCommits > 0.7) {
      suggestions.push("Consider breaking down large features into smaller, focused commits");
    }

    if (fixCount / totalCommits > 0.5) {
      suggestions.push("High fix-to-feature ratio detected. Consider more thorough testing");
    }

    if (testCount / totalCommits < 0.1) {
      suggestions.push("Add more test-related commits to improve code quality");
    }

    if (docsCount / totalCommits < 0.05) {
      suggestions.push("Consider adding more documentation commits");
    }

    // Analyze commit frequency
    if (analytics.thisWeekCommits < analytics.lastWeekCommits * 0.5) {
      suggestions.push("Commit frequency has decreased. Consider smaller, more frequent commits");
    }

    // Analyze scope usage
    const scopedCommits = Object.values(analytics.commitsByScope).reduce((a, b) => a + b, 0);
    if (scopedCommits / totalCommits < 0.3) {
      suggestions.push("Use commit scopes more consistently to organize changes");
    }

    // Analyze message patterns
    const shortMessages = commits.filter(c => c.message.length < 10).length;
    if (shortMessages / totalCommits > 0.2) {
      suggestions.push("Write more descriptive commit messages (aim for 10+ characters)");
    }

    return suggestions;
  }

  public static displayAnalytics(analytics: CommitAnalytics): void {
    console.log(
      boxen(
        chalk.blue.bold("📊 Commit Analytics Dashboard\n\n") +

        chalk.yellow("📈 Overview\n") +
        chalk.dim(`Total Commits: ${analytics.totalCommits}\n`) +
        chalk.dim(`Average per day: ${analytics.averageCommitsPerDay.toFixed(2)}\n`) +
        chalk.dim(`Most active day: ${analytics.mostActiveDay}\n\n`) +

        chalk.yellow("📊 Trends\n") +
        chalk.dim(`This week: ${analytics.commitTrends.thisWeek} commits\n`) +
        chalk.dim(`Last week: ${analytics.commitTrends.lastWeek} commits\n`) +
        chalk.dim(`This month: ${analytics.commitTrends.thisMonth} commits\n`) +
        chalk.dim(`Last month: ${analytics.commitTrends.lastMonth} commits\n\n`) +

        chalk.yellow("🏷️  Commit Types\n") +
        Object.entries(analytics.commitsByType)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([type, count]) =>
            chalk.dim(`${type}: ${count} (${((count / analytics.totalCommits) * 100).toFixed(1)}%)\n`)
          ).join('') +

        (Object.keys(analytics.commitsByScope).length > 0 ?
          chalk.yellow("\n🎯 Top Scopes\n") +
          Object.entries(analytics.commitsByScope)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([scope, count]) => chalk.dim(`${scope}: ${count} commits\n`)).join('')
          : "") +

        (analytics.suggestions.length > 0 ?
          chalk.yellow("\n💡 Suggestions\n") +
          analytics.suggestions.map(s => chalk.dim(`• ${s}\n`)).join('')
          : ""),
        {
          padding: 1,
          margin: 1,
          borderStyle: "round",
          borderColor: "blue"
        }
      )
    );
  }
}