import { execSync } from "child_process";
import { GitOperationError } from "../types/index.js";
import { extname, basename } from "path";

export interface FileChange {
  path: string;
  status: 'A' | 'M' | 'D' | 'R' | 'C';
  additions: number;
  deletions: number;
}

export interface SmartSuggestion {
  type: string;
  scope?: string;
  confidence: number;
  reason: string;
  suggestedMessage?: string;
}

export class AutoDetectionEngine {
  private static readonly TYPE_PATTERNS = {
    feat: {
      keywords: ['add', 'implement', 'create', 'new', 'introduce'],
      filePatterns: [/\.feature$/, /stories?\./, /example/],
      confidence: 0.8
    },
    fix: {
      keywords: ['fix', 'resolve', 'correct', 'patch', 'repair', 'bug'],
      filePatterns: [/\.test\./, /\.spec\./, /bug/, /fix/],
      confidence: 0.9
    },
    docs: {
      keywords: ['document', 'readme', 'doc', 'comment', 'guide'],
      filePatterns: [/\.md$/, /\.rst$/, /\.txt$/, /README/, /CHANGELOG/, /docs?\//],
      confidence: 0.95
    },
    style: {
      keywords: ['format', 'style', 'lint', 'prettier', 'whitespace'],
      filePatterns: [/\.css$/, /\.scss$/, /\.less$/, /eslint/, /prettier/],
      confidence: 0.85
    },
    refactor: {
      keywords: ['refactor', 'restructure', 'reorganize', 'cleanup', 'rename'],
      filePatterns: [/move/, /rename/, /refactor/],
      confidence: 0.8
    },
    test: {
      keywords: ['test', 'spec', 'coverage', 'unit', 'integration'],
      filePatterns: [/\.test\./, /\.spec\./, /__tests__\//, /test\//, /spec\//],
      confidence: 0.9
    },
    build: {
      keywords: ['build', 'compile', 'bundle', 'webpack', 'rollup'],
      filePatterns: [/webpack/, /rollup/, /vite/, /build/, /package\.json$/, /tsconfig/],
      confidence: 0.85
    },
    ci: {
      keywords: ['ci', 'cd', 'deploy', 'release', 'publish'],
      filePatterns: [/\.github\//, /\.gitlab-ci/, /Dockerfile/, /docker/, /\.yml$/, /\.yaml$/],
      confidence: 0.9
    },
    chore: {
      keywords: ['chore', 'update', 'bump', 'upgrade', 'maintain'],
      filePatterns: [/package-lock\.json$/, /yarn\.lock$/, /node_modules/],
      confidence: 0.7
    }
  };

  private static readonly SCOPE_PATTERNS = {
    api: [/api\//, /endpoint/, /route/, /controller/],
    ui: [/component/, /view/, /page/, /ui\//, /frontend/],
    db: [/migration/, /schema/, /model/, /database/],
    auth: [/auth/, /login/, /permission/, /security/],
    config: [/config/, /setting/, /env/, /\.env/],
    deps: [/package\.json$/, /yarn\.lock$/, /package-lock\.json$/],
    core: [/core\//, /lib\//, /util/, /helper/],
    types: [/\.d\.ts$/, /types?\//, /interface/]
  };

  public static async getChangedFiles(): Promise<FileChange[]> {
    try {
      // Get staged files
      const stagedOutput = execSync("git diff --cached --name-status", { encoding: "utf8" });
      const changes: FileChange[] = [];

      if (stagedOutput.trim()) {
        const lines = stagedOutput.trim().split('\n');
        for (const line of lines) {
          const [status, ...pathParts] = line.split('\t');
          const path = pathParts.join('\t');

          // Get detailed diff stats
          let additions = 0;
          let deletions = 0;
          try {
            const statOutput = execSync(`git diff --cached --numstat "${path}"`, { encoding: "utf8" });
            const [add, del] = statOutput.trim().split('\t');
            additions = parseInt(add) || 0;
            deletions = parseInt(del) || 0;
          } catch {
            // Fallback for binary files or errors
          }

          changes.push({
            path,
            status: status as FileChange['status'],
            additions,
            deletions
          });
        }
      }

      return changes;
    } catch (error) {
      throw new GitOperationError(
        "Failed to get changed files",
        error instanceof Error ? error : undefined
      );
    }
  }

  public static async analyzeChanges(): Promise<SmartSuggestion[]> {
    const changes = await this.getChangedFiles();

    if (changes.length === 0) {
      return [{
        type: 'chore',
        confidence: 0.5,
        reason: 'No staged changes detected',
        suggestedMessage: 'update files'
      }];
    }

    const suggestions: SmartSuggestion[] = [];

    // Analyze by file patterns
    const typeScores: Record<string, { score: number; reasons: string[] }> = {};
    const scopeScores: Record<string, number> = {};

    for (const change of changes) {
      const fileName = basename(change.path);
      const filePath = change.path.toLowerCase();

      // Analyze commit type
      for (const [type, pattern] of Object.entries(this.TYPE_PATTERNS)) {
        if (!typeScores[type]) {
          typeScores[type] = { score: 0, reasons: [] };
        }

        // Check file patterns
        for (const filePattern of pattern.filePatterns) {
          if (filePattern.test(filePath)) {
            typeScores[type].score += pattern.confidence;
            typeScores[type].reasons.push(`${change.path} matches ${type} pattern`);
          }
        }

        // Check for new files (usually features)
        if (change.status === 'A' && type === 'feat') {
          typeScores[type].score += 0.3;
          typeScores[type].reasons.push(`New file: ${change.path}`);
        }

        // Check for deleted files
        if (change.status === 'D' && (type === 'refactor' || type === 'chore')) {
          typeScores[type].score += 0.4;
          typeScores[type].reasons.push(`Deleted file: ${change.path}`);
        }

        // Check for test files
        if (type === 'test' && (/\.test\./.test(filePath) || /\.spec\./.test(filePath))) {
          typeScores[type].score += 0.8;
          typeScores[type].reasons.push(`Test file: ${change.path}`);
        }
      }

      // Analyze scope
      for (const [scope, patterns] of Object.entries(this.SCOPE_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(filePath)) {
            scopeScores[scope] = (scopeScores[scope] || 0) + 1;
          }
        }
      }
    }

    // Get diff content for keyword analysis
    try {
      const diffOutput = execSync("git diff --cached", { encoding: "utf8" });
      this.analyzeKeywords(diffOutput, typeScores);
    } catch {
      // Ignore diff errors
    }

    // Generate suggestions from scores
    const sortedTypes = Object.entries(typeScores)
      .filter(([, data]) => data.score > 0)
      .sort(([, a], [, b]) => b.score - a.score);

    if (sortedTypes.length > 0) {
      const [topType, topData] = sortedTypes[0];
      const topScope = Object.entries(scopeScores)
        .sort(([, a], [, b]) => b - a)[0]?.[0];

      suggestions.push({
        type: topType,
        scope: topScope,
        confidence: Math.min(topData.score / changes.length, 1),
        reason: topData.reasons.slice(0, 3).join(', '),
        suggestedMessage: this.generateSuggestedMessage(topType, topScope, changes)
      });

      // Add alternative suggestions
      for (const [type, data] of sortedTypes.slice(1, 3)) {
        if (data.score > 0.3) {
          suggestions.push({
            type,
            scope: topScope,
            confidence: Math.min(data.score / changes.length, 1),
            reason: data.reasons[0] || `Based on file analysis`,
          });
        }
      }
    }

    return suggestions.length > 0 ? suggestions : [{
      type: 'chore',
      confidence: 0.5,
      reason: 'Default suggestion based on file changes',
      suggestedMessage: `update ${changes.length} file${changes.length > 1 ? 's' : ''}`
    }];
  }

  private static analyzeKeywords(diffContent: string, typeScores: Record<string, { score: number; reasons: string[] }>): void {
    const addedLines = diffContent
      .split('\n')
      .filter(line => line.startsWith('+') && !line.startsWith('+++'))
      .join(' ')
      .toLowerCase();

    for (const [type, pattern] of Object.entries(this.TYPE_PATTERNS)) {
      for (const keyword of pattern.keywords) {
        if (addedLines.includes(keyword)) {
          if (!typeScores[type]) {
            typeScores[type] = { score: 0, reasons: [] };
          }
          typeScores[type].score += 0.2;
          typeScores[type].reasons.push(`Contains keyword: ${keyword}`);
        }
      }
    }
  }

  private static generateSuggestedMessage(type: string, scope: string | undefined, changes: FileChange[]): string {
    const fileCount = changes.length;
    const hasNewFiles = changes.some(c => c.status === 'A');
    const hasDeletedFiles = changes.some(c => c.status === 'D');

    const mainFile = changes[0]?.path;
    const fileName = mainFile ? basename(mainFile, extname(mainFile)) : 'files';

    let action = '';
    switch (type) {
      case 'feat':
        action = hasNewFiles ? 'add' : 'implement';
        break;
      case 'fix':
        action = 'fix';
        break;
      case 'docs':
        action = 'update documentation for';
        break;
      case 'style':
        action = 'format';
        break;
      case 'refactor':
        action = hasDeletedFiles ? 'remove' : 'refactor';
        break;
      case 'test':
        action = 'add tests for';
        break;
      case 'build':
        action = 'update build for';
        break;
      case 'ci':
        action = 'update CI for';
        break;
      default:
        action = 'update';
    }

    if (fileCount === 1) {
      return `${action} ${fileName}`;
    } else {
      return scope
        ? `${action} ${scope} components`
        : `${action} ${fileCount} files`;
    }
  }

  public static async getSuggestionsForCurrentChanges(): Promise<SmartSuggestion[]> {
    try {
      return await this.analyzeChanges();
    } catch (error) {
      return [{
        type: 'chore',
        confidence: 0.3,
        reason: 'Error analyzing changes',
        suggestedMessage: 'update files'
      }];
    }
  }
}