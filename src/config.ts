import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import chalk from "chalk";

export interface CommitTypeConfig {
  name: string;
  value: string;
  color: keyof typeof chalk;
  description: string;
}

export interface GitCleanConfig {
  commitTypes?: CommitTypeConfig[];
  spellCheck?: {
    enabled?: boolean;
    debounceMs?: number;
  };
  prompts?: {
    scope?: boolean;
    body?: boolean;
    breaking?: boolean;
    issues?: boolean;
  };
}

const DEFAULT_COMMIT_TYPES: CommitTypeConfig[] = [
  {
    name: "ADD",
    value: "ADD",
    color: "green",
    description: "Add new code or files",
  },
  {
    name: "FIX",
    value: "FIX",
    color: "red",
    description: "A bug fix",
  },
  {
    name: "UPDATE",
    value: "UPDATE",
    color: "yellow",
    description: "Update a file or code",
  },
  {
    name: "DOCS",
    value: "DOCS",
    color: "blue",
    description: "Documentation changes",
  },
  {
    name: "TEST",
    value: "TEST",
    color: "cyan",
    description: "Adding tests",
  },
  {
    name: "REMOVE",
    value: "REMOVE",
    color: "redBright",
    description: "Remove code or files",
  },
];

const DEFAULT_CONFIG: GitCleanConfig = {
  commitTypes: DEFAULT_COMMIT_TYPES,
  spellCheck: {
    enabled: true,
    debounceMs: 150,
  },
  prompts: {
    scope: true,
    body: false,
    breaking: false,
    issues: false,
  },
};

/**
 * Get the path to the global config file in the user's home directory
 */
function getGlobalConfigPath(): string {
  return join(homedir(), ".gitclean.config.json");
}

/**
 * Get the path to the project-specific config file
 */
function getProjectConfigPath(): string {
  return join(process.cwd(), ".gitclean.config.json");
}

/**
 * Load and parse a config file from the given path
 */
function loadConfigFromPath(configPath: string): GitCleanConfig | null {
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const configContent = readFileSync(configPath, "utf-8");
    return JSON.parse(configContent);
  } catch (error) {
    console.warn(
      chalk.yellow(
        `Warning: Could not parse config at ${configPath}. Skipping.`
      )
    );
    return null;
  }
}

/**
 * Merge two configs, with the override config taking precedence
 */
function mergeConfigs(base: GitCleanConfig, override: GitCleanConfig): GitCleanConfig {
  return {
    commitTypes: override.commitTypes ?? base.commitTypes,
    spellCheck: {
      enabled: override.spellCheck?.enabled ?? base.spellCheck?.enabled ?? true,
      debounceMs: override.spellCheck?.debounceMs ?? base.spellCheck?.debounceMs ?? 150,
    },
    prompts: {
      scope: override.prompts?.scope ?? base.prompts?.scope ?? true,
      body: override.prompts?.body ?? base.prompts?.body ?? false,
      breaking: override.prompts?.breaking ?? base.prompts?.breaking ?? false,
      issues: override.prompts?.issues ?? base.prompts?.issues ?? false,
    },
  };
}

/**
 * Load configuration with the following precedence:
 * 1. Project-specific config (.gitclean.config.json in current directory)
 * 2. Global config (~/.gitclean.config.json)
 * 3. Default config
 */
export function loadConfig(): GitCleanConfig {
  const globalConfigPath = getGlobalConfigPath();
  const projectConfigPath = getProjectConfigPath();

  // Start with default config
  let config = DEFAULT_CONFIG;

  // Load global config if it exists
  const globalConfig = loadConfigFromPath(globalConfigPath);
  if (globalConfig) {
    config = mergeConfigs(config, globalConfig);
  }

  // Load project config if it exists (overrides global)
  const projectConfig = loadConfigFromPath(projectConfigPath);
  if (projectConfig) {
    config = mergeConfigs(config, projectConfig);
  }

  return config;
}

export function getCommitTypes(): Array<{
  name: string;
  value: string;
  short: string;
}> {
  const config = loadConfig();
  const commitTypes = config.commitTypes || DEFAULT_COMMIT_TYPES;

  return commitTypes.map((type) => ({
    name: `${(chalk[type.color] as (text: string) => string)(type.value.padEnd(12))} - ${type.description}`,
    value: type.value,
    short: type.value,
  }));
}

export function getCommitTypeConfig(value: string): CommitTypeConfig {
  const config = loadConfig();
  const commitTypes = config.commitTypes || DEFAULT_COMMIT_TYPES;

  return (
    commitTypes.find((type) => type.value === value) || DEFAULT_COMMIT_TYPES[0]
  );
}

export function initializeConfig(global: boolean = false): void {
  const configPath = global ? getGlobalConfigPath() : getProjectConfigPath();

  if (existsSync(configPath)) {
    throw new Error("Config file already exists at " + configPath);
  }

  const configContent = JSON.stringify(DEFAULT_CONFIG, null, 2);
  writeFileSync(configPath, configContent, "utf-8");
}

export function getDefaultCommitTypes(): CommitTypeConfig[] {
  return DEFAULT_COMMIT_TYPES;
}

export function getConfigAsString(): string {
  const config = loadConfig();
  return JSON.stringify(config, null, 2);
}
