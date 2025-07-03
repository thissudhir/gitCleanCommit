import inquirer from "inquirer";
import chalk from "chalk";
import { checkSpelling } from "./spellcheck.js";
import { executeGitCommit } from "./git-integration.js";
import { writeFileSync } from "fs";

interface CommitType {
  name: string;
  value: string;
  color: keyof typeof chalk;
  emoji: string;
  description: string;
}

const COMMIT_TYPES: CommitType[] = [
  // {
  //   name: "FEATURE      - A new feature",
  //   value: "FEATURE",
  //   color: "green",
  //   emoji: "🚀",
  //   description: "A new feature",
  // },
  {
    name: "ADD          - Add new code or files",
    value: "ADD",
    color: "redBright",
    emoji: "🔥",
    description: "Added new code or files",
  },
  {
    name: "FIX          - A bug fix",
    value: "FIX",
    color: "red",
    emoji: "🐛",
    description: "A bug fix",
  },
  // {
  //   name: "MODIFY       - Modify a file or code",
  //   value: "MODIFY",
  //   color: "red",
  //   emoji: "🐛",
  //   description: "Modified a file or code",
  // },
  {
    name: "UPDATE       - Updated a file or code",
    value: "UPDATE",
    color: "red",
    emoji: "🐛",
    description: "Updated a file or code",
  },
  {
    name: "DOCS         - Documentation changes",
    value: "DOCS",
    color: "blue",
    emoji: "📚",
    description: "Documentation only changes",
  },
  // {
  //   name: "STYLE        - Code style changes",
  //   value: "STYLE",
  //   color: "magenta",
  //   emoji: "💄",
  //   description: "Changes that do not affect the meaning of the code",
  // },
  // {
  //   name: "REFACTOR     - Code refactoring",
  //   value: "REFACTOR",
  //   color: "yellow",
  //   emoji: "♻️",
  //   description: "A code change that neither fixes a bug nor adds a feature",
  // },
  {
    name: "TEST         - Adding tests",
    value: "TEST",
    color: "cyan",
    emoji: "✅",
    description: "Adding missing tests or correcting existing tests",
  },
  // {
  //   name: "CHORE        - Maintenance tasks",
  //   value: "CHORE",
  //   color: "gray",
  //   emoji: "🔧",
  //   description: "Other changes that don't modify src or test files",
  // },
  // {
  //   name: "PERFORMANCE  - Performance improvements",
  //   value: "PERFORMANCE",
  //   color: "greenBright",
  //   emoji: "⚡",
  //   description: "A code change that improves performance",
  // },
  // {
  //   name: "REMOVE       - Removing code or files",
  //   value: "REMOVE",
  //   color: "redBright",
  //   emoji: "🔥",
  //   description: "Removing code or files",
  // },
];

function createSquigglyUnderline(text: string, typos: string[]): string {
  let result = text;

  for (const typo of typos) {
    // Create a regex to find the typo with word boundaries
    const regex = new RegExp(`\\b${typo}\\b`, "gi");
    result = result.replace(regex, (match) => {
      // Create squiggly underline using combining characters
      const squiggly = "\u0330".repeat(match.length); // Combining tilde below
      return chalk.red(match + squiggly);
    });
  }

  return result;
}

function displayTypoWarnings(typos: string[]): void {
  if (typos.length > 0) {
    console.log(chalk.yellow("\n⚠️  Potential spelling issues detected:"));
    typos.forEach((typo) => {
      console.log(chalk.red(`   ${chalk.red("~".repeat(typo.length))}`));
      console.log(chalk.red(`   ${typo}`));
    });
    console.log(chalk.yellow("   Please review your commit message.\n"));
  }
}

export async function promptCommit(hookFile?: string): Promise<void> {
  const answers = await inquirer.prompt([
    {
      name: "type",
      type: "list",
      message: "Select the type of change you're committing:",
      choices: COMMIT_TYPES.map((type) => ({
        name: type.name,
        value: type.value,
        short: type.emoji + " " + type.value,
      })),
      pageSize: 15,
    },
    {
      name: "scope",
      type: "input",
      message: "What is the scope of this change? (optional):",
      filter: (input: string) => input.trim(),
    },
    {
      name: "message",
      type: "input",
      message: "Write a short, imperative tense description of the change:",
      validate: (input: string) => {
        if (input.length < 1) {
          return "Please enter a commit message.";
        }
        if (input.length > 72) {
          return "Keep the first line under 72 characters.";
        }
        return true;
      },
      filter: (input: string) => input.trim(),
    },
    {
      name: "body",
      type: "input",
      message: "Provide a longer description of the change (optional):",
      filter: (input: string) => input.trim(),
    },
    {
      name: "breaking",
      type: "confirm",
      message: "Are there any breaking changes?",
      default: false,
    },
    {
      name: "issues",
      type: "input",
      message: 'Add issue references (e.g., "fixes #123", "closes #456"):',
      filter: (input: string) => input.trim(),
    },
  ]);

  // Spell check
  const typos = checkSpelling(answers.message);
  const bodyTypos = answers.body ? checkSpelling(answers.body) : [];
  const allTypos = [...typos, ...bodyTypos];

  // Find the selected commit type
  const selectedType = COMMIT_TYPES.find(
    (type) => type.value === answers.type
  )!;

  // Build the commit message
  const breakingPrefix = answers.breaking ? "!" : "";
  const scope = answers.scope ? `(${answers.scope})` : "";
  const commitHeader = `${answers.type}${scope}${breakingPrefix}: ${answers.message}`;

  let fullCommit = commitHeader;
  if (answers.body) {
    fullCommit += `\n\n${answers.body}`;
  }
  if (answers.breaking) {
    fullCommit += `\n\nBREAKING CHANGE: ${answers.message}`;
  }
  if (answers.issues) {
    fullCommit += `\n\n${answers.issues}`;
  }

  // Display the generated commit message
  console.log(chalk.bold("\n📝 Generated Commit Message:\n"));
  console.log(
    "┌─────────────────────────────────────────────────────────────────────────────┐"
  );

  // Display header with proper coloring
  const colorFn = chalk[selectedType.color] as any;
  console.log(
    `│ ${colorFn(selectedType.emoji + " " + commitHeader).padEnd(75)} │`
  );

  if (answers.body) {
    // console.log(
    //   "│                                                                               │"
    // );
    const bodyLines = answers.body.split("\n");
    bodyLines.forEach((line: string) => {
      console.log(`│ ${chalk.gray(line).padEnd(75)} │`);
    });
  }

  if (answers.breaking) {
    // console.log(
    //   "│                                                                               │"
    // );
    console.log(
      `│ ${chalk.red.bold("💥 BREAKING CHANGE: " + answers.message).padEnd(75)} │`
    );
  }

  if (answers.issues) {
    // console.log(
    //   "│                                                                               │"
    // );
    console.log(`│ ${chalk.blue(answers.issues).padEnd(75)} │`);
  }

  console.log(
    "└─────────────────────────────────────────────────────────────────────────────┘"
  );

  // Show typo warnings with squiggly underlines
  if (allTypos.length > 0) {
    console.log(chalk.yellow("\n⚠️  Potential spelling issues detected:"));
    console.log(chalk.yellow("Message with issues highlighted:"));

    const highlightedHeader = createSquigglyUnderline(commitHeader, typos);
    console.log(`${colorFn(selectedType.emoji)} ${highlightedHeader}`);

    if (answers.body && bodyTypos.length > 0) {
      const highlightedBody = createSquigglyUnderline(answers.body, bodyTypos);
      console.log(chalk.gray("\nBody:"));
      console.log(highlightedBody);
    }

    displayTypoWarnings(allTypos);
  }

  // Final confirmation
  const { confirm } = await inquirer.prompt([
    {
      name: "confirm",
      type: "confirm",
      message:
        allTypos.length > 0
          ? "Do you want to proceed with this commit despite potential spelling issues?"
          : "Looks good! Create this commit?",
      default: allTypos.length === 0,
    },
  ]);

  if (confirm) {
    if (hookFile) {
      // Write to the commit message file for git hook
      writeFileSync(hookFile, fullCommit);
    } else {
      // Execute git commit directly
      executeGitCommit(commitHeader, answers.body);
    }

    console.log(chalk.green("\n✅ Commit message created successfully!"));
  } else {
    console.log(
      chalk.yellow(
        "\n❌ Commit cancelled. Run the command again to create a new message."
      )
    );
    process.exit(1);
  }
}
