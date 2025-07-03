#!/usr/bin/env node

import { execSync } from "child_process";
import { existsSync, chmodSync } from "fs";
import { join } from "path";
import chalk from "chalk";

console.log(chalk.cyan("🚀 Setting up GitClean CLI...\n"));

try {
  // Check if we're in a development environment
  const isDev = existsSync("src") && existsSync("tsconfig.json");

  if (isDev) {
    console.log(chalk.blue("📦 Development environment detected"));
    console.log(chalk.blue("🔨 Building TypeScript files..."));

    // Build the project
    execSync("npm run build", { stdio: "inherit" });

    console.log(chalk.green("✅ Build completed successfully!"));
  }

  // Make the built file executable
  const indexPath = join(process.cwd(), "dist", "index.js");
  if (existsSync(indexPath)) {
    chmodSync(indexPath, 0o755);
    console.log(chalk.green("✅ Made executable"));
  }

  console.log(chalk.green("\n🎉 GitClean CLI is ready!"));
  console.log(chalk.dim('Run "gitclean setup" to configure git hooks.'));
} catch (error) {
  console.error(chalk.red("❌ Setup failed:"), error.message);
  process.exit(1);
}
