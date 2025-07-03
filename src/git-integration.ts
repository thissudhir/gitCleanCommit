import { execSync, spawn } from "child_process";
import { writeFileSync, readFileSync, existsSync, chmodSync } from "fs";
import { join } from "path";
import chalk from "chalk";

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function findGitRoot(): string {
  try {
    const gitRoot = execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
    }).trim();
    return gitRoot;
  } catch (error) {
    throw new Error("Not in a git repository");
  }
}

export async function setupGitHook(): Promise<void> {
  const gitRoot = findGitRoot();
  const hooksDir = join(gitRoot, ".git", "hooks");
  const commitMsgHook = join(hooksDir, "prepare-commit-msg");

  // Create the hook script
  const hookScript = `#!/bin/sh
# GitClean prepare-commit-msg hook
# This hook is installed by gitclean CLI tool

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2

# Only run for regular commits (not merge, squash, etc.)
if [ -z "$COMMIT_SOURCE" ] || [ "$COMMIT_SOURCE" = "message" ]; then
  # Check if this is an empty commit message
  if [ ! -s "$COMMIT_MSG_FILE" ] || grep -q "^#" "$COMMIT_MSG_FILE"; then
    # Run gitclean in interactive mode and pass the commit message file
    gitclean commit --hook "$COMMIT_MSG_FILE"
  fi
fi
`;

  writeFileSync(commitMsgHook, hookScript);
  chmodSync(commitMsgHook, 0o755);
}

export async function removeGitHook(): Promise<void> {
  const gitRoot = findGitRoot();
  const commitMsgHook = join(gitRoot, ".git", "hooks", "prepare-commit-msg");

  if (existsSync(commitMsgHook)) {
    const content = readFileSync(commitMsgHook, "utf8");
    if (content.includes("GitClean prepare-commit-msg hook")) {
      execSync(`rm "${commitMsgHook}"`);
    } else {
      throw new Error("Hook exists but was not created by GitClean");
    }
  }
}

export function executeGitAdd(files: string[] = ["."]): void {
  try {
    const args = ["add", ...files];

    console.log(chalk.blue(`📁 Adding files: ${files.join(", ")}`));
    execSync(`git ${args.join(" ")}`, { stdio: "inherit" });
    console.log(chalk.green("✅ Files added successfully!"));
  } catch (error) {
    console.error(
      chalk.red("Failed to execute git add:"),
      getErrorMessage(error)
    );
    throw error;
  }
}

export function executeGitCommit(message: string, body?: string): void {
  try {
    const args = ["commit", "-m", message];
    if (body) {
      args.push("-m", body);
    }

    const result = spawn("git", args, { stdio: "inherit" });
    result.on("close", (code) => {
      if (code === 0) {
        console.log(chalk.green("\n✅ Commit created successfully!"));
      } else {
        console.log(chalk.red("\n❌ Commit failed"));
      }
    });
  } catch (error) {
    console.error(
      chalk.red("Failed to execute git commit:"),
      getErrorMessage(error)
    );
  }
}

export async function executeGitAddAndCommit(
  files: string[] = ["."],
  commitMessage?: string,
  commitBody?: string
): Promise<void> {
  try {
    // First, add the files
    executeGitAdd(files);

    // Then proceed with the commit
    if (commitMessage) {
      // If message is provided, commit directly
      executeGitCommit(commitMessage, commitBody);
    } else {
      // If no message provided, this will trigger the GitClean prompt
      // through the prepare-commit-msg hook
      console.log(chalk.blue("\n🚀 Opening GitClean commit prompt..."));
      executeGitCommit(""); // Empty message will trigger the hook
    }
  } catch (error) {
    console.error(
      chalk.red("Failed to execute git add and commit:"),
      getErrorMessage(error)
    );
  }
}

export function checkWorkingDirectory(): {
  hasChanges: boolean;
  hasStagedFiles: boolean;
} {
  try {
    // Check for unstaged changes
    const unstagedChanges = execSync("git diff --name-only", {
      encoding: "utf8",
    }).trim();

    // Check for staged changes
    const stagedChanges = execSync("git diff --cached --name-only", {
      encoding: "utf8",
    }).trim();

    return {
      hasChanges: unstagedChanges.length > 0,
      hasStagedFiles: stagedChanges.length > 0,
    };
  } catch (error) {
    console.error(
      chalk.red("Failed to check working directory:"),
      getErrorMessage(error)
    );
    return { hasChanges: false, hasStagedFiles: false };
  }
}

export function getGitStatus(): string {
  try {
    return execSync("git status --porcelain", { encoding: "utf8" });
  } catch (error) {
    console.error(
      chalk.red("Failed to get git status:"),
      getErrorMessage(error)
    );
    return "";
  }
}
