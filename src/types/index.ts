export interface CommitType {
  name: string;
  value: string;
  color: string;
  emoji: string;
  description: string;
}

export interface SpellCheckResult {
  word: string;
  suggestions: string[];
  isCorrect: boolean;
  position: { start: number; end: number };
}

export interface GitCleanConfig {
  commitTypes?: CommitType[];
  spellCheck?: {
    enabled?: boolean;
    debounceMs?: number;
    customWords?: string[];
    disabledWords?: string[];
  };
  workflow?: {
    autoAdd?: boolean;
    autoPush?: boolean;
    addFiles?: string[];
  };
  templates?: CommitTemplate[];
  preCommitHooks?: string[];
}

export interface CommitTemplate {
  name: string;
  type: string;
  scope?: string;
  message: string;
  body?: string;
  breaking?: boolean;
}

export interface CommitAnswers {
  type: string;
  scope: string;
  message: string;
  body: string;
  breaking: boolean;
  issues: string;
}

export interface WorkflowOptions {
  hookFile?: string;
}

export interface SpellCheckStats {
  isInitialized: boolean;
  hasDictionary: boolean;
  technicalWordsCount: number;
  typoRulesCount: number;
}

export interface GitWorkingDirectory {
  hasChanges: boolean;
  hasStagedFiles: boolean;
}

export class GitCleanError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'GitCleanError';
  }
}

export class SpellCheckError extends GitCleanError {
  constructor(message: string, cause?: Error) {
    super(message, 'SPELL_CHECK_ERROR', cause);
  }
}

export class GitOperationError extends GitCleanError {
  constructor(message: string, cause?: Error) {
    super(message, 'GIT_OPERATION_ERROR', cause);
  }
}

export class ConfigurationError extends GitCleanError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIGURATION_ERROR', cause);
  }
}