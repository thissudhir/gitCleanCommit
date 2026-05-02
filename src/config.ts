import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import chalk from "chalk";
import { z } from "zod";

const AI_PROVIDERS = ["gemini", "openai", "deepseek", "anthropic", "ollama", "groq", "custom"] as const;

const CommitTypeSchema = z.object({
  name: z.string().min(1, "name must be non-empty"),
  value: z.string().min(1, "value must be non-empty"),
  color: z.string().min(1, "color must be a non-empty string (e.g. 'green', 'red')"),
  description: z.string(),
});

const GitCleanConfigSchema = z.object({
  commitTypes: z.array(CommitTypeSchema).optional(),
  spellCheck: z.object({
    enabled: z.boolean().optional(),
    debounceMs: z.number().int().positive("debounceMs must be a positive integer").optional(),
  }).optional(),
  prompts: z.object({
    scope: z.boolean().optional(),
    body: z.boolean().optional(),
    breaking: z.boolean().optional(),
    issues: z.boolean().optional(),
  }).optional(),
  ai: z.object({
    provider: z.enum(AI_PROVIDERS, {
      error: `provider must be one of: ${AI_PROVIDERS.join(", ")}`,
    }).optional(),
    model: z.string().optional(),
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
  }).optional(),
});

export type CommitTypeConfig = z.infer<typeof CommitTypeSchema>;
export type GitCleanConfig = z.infer<typeof GitCleanConfigSchema>;

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
  ai: {
    provider: "gemini",
    model: "gemini-1.5-flash",
    apiKey: ""
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
/** Strip single-line // comments so config files can contain helpful hints. */
function stripComments(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.replace(/\s*\/\/.*$/, ""))
    .join("\n");
}

function loadConfigFromPath(configPath: string): GitCleanConfig | null {
  if (!existsSync(configPath)) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(stripComments(readFileSync(configPath, "utf-8")));
  } catch {
    console.warn(chalk.yellow(`Warning: Could not parse JSON in ${configPath}. Skipping.`));
    return null;
  }

  const result = GitCleanConfigSchema.safeParse(raw);
  if (!result.success) {
    console.warn(chalk.yellow(`\nWarning: Invalid config at ${configPath}:`));
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? issue.path.join(".") : "root";
      console.warn(chalk.dim(`  • ${field}: ${issue.message}`));
    }
    console.warn(chalk.dim("  Falling back to defaults for this config file.\n"));
    return null;
  }

  return result.data;
}


function mergeConfigs(base: GitCleanConfig, override: GitCleanConfig): GitCleanConfig {
  const finalProvider = override.ai?.provider ?? base.ai?.provider ?? "gemini";
  const sameProvider = !override.ai?.provider || override.ai.provider === base.ai?.provider;

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
    ai: {
      provider: finalProvider as "gemini" | "openai" | "deepseek" | "anthropic" | "ollama" | "groq" | "custom",
      model: override.ai?.model ?? (sameProvider ? base.ai?.model : undefined),
      apiKey: override.ai?.apiKey ?? (sameProvider ? base.ai?.apiKey : undefined),
      baseURL: override.ai?.baseURL ?? (sameProvider ? base.ai?.baseURL : undefined),
    },
  };
}

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
    name: `${((chalk as any)[type.color] as (text: string) => string)(type.value.padEnd(12))} - ${type.description}`,
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

const DEFAULT_CONFIG_TEMPLATE = `
// GitClean Configuration
// ─────────────────────────────────────────────────────────────────────────────
// Available colors for commitTypes:
//   black | red | green | yellow | blue | magenta | cyan | white | gray
//   redBright | greenBright | yellowBright | blueBright | magentaBright | cyanBright | whiteBright
//
// Available AI providers:
//   gemini | openai | anthropic | groq | deepseek | ollama | custom
// ─────────────────────────────────────────────────────────────────────────────
{
  "commitTypes": [
    {
      "name": "ADD",
      "value": "ADD",
      "color": "green",
      "description": "Add new code or files"
    },
    {
      "name": "FIX",
      "value": "FIX",
      "color": "red",
      "description": "A bug fix"
    },
    {
      "name": "UPDATE",
      "value": "UPDATE",
      "color": "yellow",
      "description": "Update a file or code"
    },
    {
      "name": "DOCS",
      "value": "DOCS",
      "color": "blue",
      "description": "Documentation changes"
    },
    {
      "name": "TEST",
      "value": "TEST",
      "color": "cyan",
      "description": "Adding tests"
    },
    {
      "name": "REMOVE",
      "value": "REMOVE",
      "color": "redBright",
      "description": "Remove code or files"
    }
  ],
  "spellCheck": {
    "enabled": true,
    "debounceMs": 150
  },
  "prompts": {
    "scope": true,
    "body": false,
    "breaking": false,
    "issues": false
  },
  "ai": {
    "provider": "gemini",
    "model": "gemini-1.5-flash",
    "apiKey": ""                // paste your key here, or set the env var (e.g. GEMINI_API_KEY)
  }
}
`;

export function initializeConfig(global: boolean = false): void {
  const configPath = global ? getGlobalConfigPath() : getProjectConfigPath();

  if (existsSync(configPath)) {
    throw new Error("Config file already exists at " + configPath);
  }

  writeFileSync(configPath, DEFAULT_CONFIG_TEMPLATE, "utf-8");
}

export function getDefaultCommitTypes(): CommitTypeConfig[] {
  return DEFAULT_COMMIT_TYPES;
}

export function getConfigAsString(): string {
  const config = loadConfig();
  return JSON.stringify(config, null, 2);
}

export function updateAiConfig(
  aiSettings: GitCleanConfig["ai"],
  global: boolean = false
): string {
  const configPath = global ? getGlobalConfigPath() : getProjectConfigPath();

  let existing: GitCleanConfig = {};
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
      existing = {};
    }
  }

  const providerChanging = aiSettings?.provider && aiSettings.provider !== existing.ai?.provider;
  if (providerChanging) {
    existing.ai = Object.fromEntries(
      Object.entries(aiSettings ?? {}).filter(([, v]) => v !== undefined)
    ) as GitCleanConfig["ai"];
  } else {
    existing.ai = { ...existing.ai, ...aiSettings };
  }
  writeFileSync(configPath, JSON.stringify(existing, null, 2), "utf-8");
  return configPath;
}
