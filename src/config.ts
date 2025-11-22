import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
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


function getConfigPath(): string {
  return join(process.cwd(), ".gitclean.config.json");
}

export function loadConfig(): GitCleanConfig {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const configContent = readFileSync(configPath, "utf-8");
    const userConfig: GitCleanConfig = JSON.parse(configContent);

    // Merge with defaults to ensure all required fields exist
    return {
      commitTypes: userConfig.commitTypes || DEFAULT_CONFIG.commitTypes,
      spellCheck: {
        enabled: userConfig.spellCheck?.enabled ?? true,
        debounceMs: userConfig.spellCheck?.debounceMs ?? 150,
      },
      prompts: {
        scope: userConfig.prompts?.scope ?? true,
        body: userConfig.prompts?.body ?? false,
        breaking: userConfig.prompts?.breaking ?? false,
        issues: userConfig.prompts?.issues ?? false,
      },
    };
  } catch (error) {
    console.warn(
      chalk.yellow(
        `Warning: Could not parse .gitclean.config.json. Using defaults.`
      )
    );
    return DEFAULT_CONFIG;
  }
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

export function initializeConfig(): void {
  const configPath = getConfigPath();

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
