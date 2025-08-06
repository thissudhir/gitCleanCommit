import { execSync, spawn } from "child_process";
import { writeFileSync, readFileSync, existsSync, chmodSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import ora from "ora";
import { GitOperationError, GitWorkingDirectory } from "./types/index.js";
import { ErrorHandler } from "./utils/error-handler.js";
import { ConfigManager } from "./config/config-manager.js";

export function findGitRoot(): string {
  try {
    const gitRoot = execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
    }).trim();
    return gitRoot;
  } catch (error) {
    throw new GitOperationError("Not in a git repository", error instanceof Error ? error : undefined);
  }
}

export function getCurrentBranch(): string {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
    return branch;
  } catch (error) {
    throw new GitOperationError("Failed to get current branch", error instanceof Error ? error : undefined);
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
  const spinner = ora("Adding files...").start();
  try {
    const args = ["add", ...files];
    execSync(`git ${args.join(" ")}`, { stdio: "pipe" });
    spinner.succeed(`Files added: ${files.join(", ")}`);
  } catch (error) {
    spinner.fail("Failed to add files");
    throw new GitOperationError("Failed to add files", error instanceof Error ? error : undefined);
  }
}

export function executeGitCommit(
  message: string,
  body?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const spinner = ora("Creating commit...").start();

    try {
      const args = ["commit", "-m", message];
      if (body) {
        args.push("-m", body);
      }

      const result = spawn("git", args, { stdio: "pipe" });

      result.on("close", (code) => {
        if (code === 0) {
          spinner.succeed("Commit created successfully!");
          resolve();
        } else {
          spinner.fail("Commit failed");
          reject(new Error("Commit failed"));
        }
      });

      result.on("error", (error) => {
        spinner.fail("Commit failed");
        reject(error);
      });
    } catch (error) {
      spinner.fail("Commit failed");
      reject(error);
    }
  });
}

export function executeGitPush(): Promise<void> {
  return new Promise((resolve, reject) => {
    const spinner = ora("Pushing to remote...").start();

    try {
      const branch = getCurrentBranch();
      const result = spawn("git", ["push", "origin", branch], {
        stdio: "pipe",
      });

      result.on("close", (code) => {
        if (code === 0) {
          spinner.succeed(`Pushed to ${branch} successfully!`);
          resolve();
        } else {
          spinner.fail("Push failed");
          reject(new Error("Push failed"));
        }
      });

      result.on("error", (error) => {
        spinner.fail("Push failed");
        reject(error);
      });
    } catch (error) {
      spinner.fail("Push failed");
      reject(error);
    }
  });
}

export async function executeFullGitWorkflow(
  commitMessage: string,
  commitBody?: string,
  files: string[] = ["."]
): Promise<void> {
  try {
    // Check if we're in a git repository
    findGitRoot();

    // Check if there are any changes to commit
    const status = getGitStatus();
    if (!status.trim()) {
      console.log(chalk.yellow("⚠️  No changes to commit"));
      return;
    }

    console.log(chalk.blue("\n🚀 Starting GitClean workflow...\n"));

    // Step 1: Add files
    executeGitAdd(files);

    // Step 2: Commit
    await executeGitCommit(commitMessage, commitBody);

    // Step 3: Push
    await executeGitPush();

    console.log(chalk.green("\n✅ GitClean workflow completed successfully!"));
    console.log(chalk.dim(`📦 Changes pushed to ${getCurrentBranch()}\n`));
  } catch (error) {
    console.error(
      chalk.red("\n❌ GitClean workflow failed:"),
      ErrorHandler.getErrorMessage(error)
    );
    throw error;
  }
}

export function checkWorkingDirectory(): GitWorkingDirectory {
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
      ErrorHandler.getErrorMessage(error)
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
      ErrorHandler.getErrorMessage(error)
    );
    return "";
  }
}
