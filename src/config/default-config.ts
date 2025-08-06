import chalk from "chalk";
import { CommitType, GitCleanConfig } from "../types/index.js";

export const DEFAULT_COMMIT_TYPES: CommitType[] = [
  {
    name: `${chalk.green("ADD")}          - Add new code or files`,
    value: "ADD",
    color: "green",
    emoji: "➕",
    description: "Added new code or files",
  },
  {
    name: `${chalk.red("FIX")}          - A bug fix`,
    value: "FIX",
    color: "red",
    emoji: "🐛",
    description: "A bug fix",
  },
  {
    name: `${chalk.yellow("UPDATE")}       - Updated a file or code`,
    value: "UPDATE",
    color: "yellow",
    emoji: "🔄",
    description: "Updated a file or code",
  },
  {
    name: `${chalk.blue("DOCS")}         - Documentation changes`,
    value: "DOCS",
    color: "blue",
    emoji: "📚",
    description: "Documentation only changes",
  },
  {
    name: `${chalk.cyan("TEST")}         - Adding tests`,
    value: "TEST",
    color: "cyan",
    emoji: "✅",
    description: "Adding missing tests or correcting existing tests",
  },
  {
    name: `${chalk.redBright("REMOVE")}       - Removing code or files`,
    value: "REMOVE",
    color: "redBright",
    emoji: "🗑️",
    description: "Removing code or files",
  },
];

export const DEFAULT_CONFIG: GitCleanConfig = {
  commitTypes: DEFAULT_COMMIT_TYPES,
  spellCheck: {
    enabled: true,
    debounceMs: 200,
    customWords: [],
    disabledWords: [],
  },
  workflow: {
    autoAdd: true,
    autoPush: true,
    addFiles: ["."],
  },
  templates: [],
  preCommitHooks: [],
};

export const CONFIG_FILE_NAME = ".gitclean.json";