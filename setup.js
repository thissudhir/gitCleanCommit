#!/usr/bin/env node

import { execSync } from "child_process";
import { existsSync, chmodSync } from "fs";
import { join } from "path";
import chalk from "chalk";

function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

console.log(chalk.cyan("🚀 Setting up GitClean CLI...\n"));

try {
  const isDev = existsSync("src") && existsSync("tsconfig.json");

  if (isDev) {
    console.log(chalk.blue("📦 Development environment detected"));
    console.log(chalk.blue("🔨 Building TypeScript files..."));
    execSync("npm run build", { stdio: "inherit" });
    console.log(chalk.green("✅ Build completed successfully!"));
  }

  // Check both possible output directories
  const distPath = join(process.cwd(), "dist", "index.js");
  const binPath = join(process.cwd(), "bin", "index.js");

  if (existsSync(distPath)) {
    chmodSync(distPath, 0o755);
    console.log(chalk.green("✅ Made dist/index.js executable"));
  } else if (existsSync(binPath)) {
    chmodSync(binPath, 0o755);
    console.log(chalk.green("✅ Made bin/index.js executable"));
  } else {
    console.log(chalk.yellow("⚠️  No built index.js found"));
  }

  console.log(chalk.green("\n🎉 GitClean CLI is ready!"));
  console.log(chalk.dim('Run "gitclean setup" to configure git hooks.'));
} catch (error) {
  console.error(chalk.red("❌ Setup failed:"), getErrorMessage(error));
  process.exit(1);
}
