#!/usr/bin/env node

import { TestFramework } from "./test-framework.js";
import { runConfigManagerTests } from "./config-manager.test.js";
import { runFormatUtilsTests } from "./format-utils.test.js";
import chalk from "chalk";

async function runAllTests(): Promise<void> {
  console.log(chalk.blue("🧪 GitClean Test Suite"));
  console.log(chalk.blue("====================="));
  
  const framework = new TestFramework();
  
  try {
    // Run all test suites
    runConfigManagerTests(framework);
    runFormatUtilsTests(framework);
    
    // Print summary
    framework.printSummary();
    
    // Exit with appropriate code
    const failureCount = framework.getFailureCount();
    process.exit(failureCount === 0 ? 0 : 1);
    
  } catch (error) {
    console.error(chalk.red("❌ Test runner failed:"), error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(chalk.blue("GitClean Test Runner"));
  console.log("Usage: npm test");
  console.log("       npm run test:watch");
  process.exit(0);
}

// Run tests
runAllTests();