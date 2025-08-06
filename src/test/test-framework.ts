import chalk from "chalk";

export interface TestResult {
  name: string;
  passed: boolean;
  error?: Error;
  duration: number;
}

export interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  duration: number;
}

export class TestFramework {
  private suites: TestSuite[] = [];
  private currentSuite: TestSuite | null = null;

  public describe(suiteName: string, tests: () => void): void {
    console.log(chalk.blue(`\n📋 ${suiteName}`));
    
    this.currentSuite = {
      name: suiteName,
      tests: [],
      passed: 0,
      failed: 0,
      duration: 0
    };

    const startTime = Date.now();
    tests();
    this.currentSuite.duration = Date.now() - startTime;
    
    this.suites.push(this.currentSuite);
    this.currentSuite = null;
  }

  public it(testName: string, testFn: () => Promise<void> | void): void {
    if (!this.currentSuite) {
      throw new Error("Test must be inside a describe block");
    }

    const startTime = Date.now();
    let result: TestResult;

    try {
      const testResult = testFn();
      
      if (testResult instanceof Promise) {
        testResult.then(() => {
          result = {
            name: testName,
            passed: true,
            duration: Date.now() - startTime
          };
          this.recordTestResult(result);
        }).catch((error) => {
          result = {
            name: testName,
            passed: false,
            error: error instanceof Error ? error : new Error(String(error)),
            duration: Date.now() - startTime
          };
          this.recordTestResult(result);
        });
      } else {
        result = {
          name: testName,
          passed: true,
          duration: Date.now() - startTime
        };
        this.recordTestResult(result);
      }
    } catch (error) {
      result = {
        name: testName,
        passed: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - startTime
      };
      this.recordTestResult(result);
    }
  }

  private recordTestResult(result: TestResult): void {
    if (!this.currentSuite) return;
    
    this.currentSuite.tests.push(result);
    
    if (result.passed) {
      this.currentSuite.passed++;
      console.log(chalk.green(`  ✅ ${result.name} (${result.duration}ms)`));
    } else {
      this.currentSuite.failed++;
      console.log(chalk.red(`  ❌ ${result.name} (${result.duration}ms)`));
      if (result.error) {
        console.log(chalk.red(`     ${result.error.message}`));
      }
    }
  }

  public printSummary(): void {
    console.log(chalk.blue("\n📊 Test Summary"));
    console.log(chalk.blue("================"));

    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;

    for (const suite of this.suites) {
      totalPassed += suite.passed;
      totalFailed += suite.failed;
      totalDuration += suite.duration;

      const status = suite.failed === 0 ? chalk.green("✅") : chalk.red("❌");
      console.log(
        `${status} ${suite.name}: ${chalk.green(suite.passed)} passed, ${chalk.red(suite.failed)} failed (${suite.duration}ms)`
      );
    }

    console.log(chalk.blue("\n📋 Overall Results"));
    console.log(`Total: ${totalPassed + totalFailed} tests`);
    console.log(chalk.green(`Passed: ${totalPassed}`));
    console.log(chalk.red(`Failed: ${totalFailed}`));
    console.log(`Duration: ${totalDuration}ms`);

    if (totalFailed === 0) {
      console.log(chalk.green("\n🎉 All tests passed!"));
    } else {
      console.log(chalk.red(`\n💥 ${totalFailed} test(s) failed!`));
    }
  }

  public getFailureCount(): number {
    return this.suites.reduce((count, suite) => count + suite.failed, 0);
  }
}

// Simple assertion functions
export const expect = {
  toBe<T>(actual: T, expected: T): void {
    if (actual !== expected) {
      throw new Error(`Expected ${actual} to be ${expected}`);
    }
  },

  toEqual<T>(actual: T, expected: T): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
    }
  },

  toBeTruthy(actual: any): void {
    if (!actual) {
      throw new Error(`Expected ${actual} to be truthy`);
    }
  },

  toBeFalsy(actual: any): void {
    if (actual) {
      throw new Error(`Expected ${actual} to be falsy`);
    }
  },

  toContain<T>(actual: T[], expected: T): void {
    if (!actual.includes(expected)) {
      throw new Error(`Expected ${JSON.stringify(actual)} to contain ${expected}`);
    }
  },

  toHaveLength(actual: any[], expectedLength: number): void {
    if (actual.length !== expectedLength) {
      throw new Error(`Expected array to have length ${expectedLength}, but got ${actual.length}`);
    }
  },

  toThrow(fn: () => void, expectedError?: string): void {
    try {
      fn();
      throw new Error("Expected function to throw an error");
    } catch (error) {
      if (expectedError && error instanceof Error && !error.message.includes(expectedError)) {
        throw new Error(`Expected error to contain "${expectedError}", but got "${error.message}"`);
      }
    }
  }
};