import inquirer from "inquirer";
import chalk from "chalk";
import { checkSpelling } from "./spellcheck.ts";
import { capitalize } from "./utils.ts";

interface CommitType {
  name: string;
  value: string;
  color: keyof typeof chalk;
  emoji: string;
  description: string;
}

const COMMIT_TYPES: CommitType[] = [
  {
    name: "feat - A new feature",
    value: "feat",
    color: "green",
    emoji: "🚀",
    description: "A new feature",
  },
  {
    name: "🐛 fix - A bug fix",
    value: "fix",
    color: "red",
    emoji: "🐛",
    description: "A bug fix",
  },
  {
    name: "📚 docs - Documentation changes",
    value: "docs",
    color: "blue",
    emoji: "📚",
    description: "Documentation only changes",
  },
  {
    name: "💄 style - Code style changes",
    value: "style",
    color: "magenta",
    emoji: "💄",
    description: "Changes that do not affect the meaning of the code",
  },
  {
    name: "♻️ refactor - Code refactoring",
    value: "refactor",
    color: "yellow",
    emoji: "♻️",
    description: "A code change that neither fixes a bug nor adds a feature",
  },
  {
    name: "✅ test - Adding tests",
    value: "test",
    color: "cyan",
    emoji: "✅",
    description: "Adding missing tests or correcting existing tests",
  },
  {
    name: "🔧 chore - Maintenance tasks",
    value: "chore",
    color: "gray",
    emoji: "🔧",
    description: "Other changes that don't modify src or test files",
  },
  {
    name: "⚡ perf - Performance improvements",
    value: "perf",
    color: "greenBright",
    emoji: "⚡",
    description: "A code change that improves performance",
  },
  {
    name: "🔥 remove - Removing code or files",
    value: "remove",
    color: "redBright",
    emoji: "🔥",
    description: "Removing code or files",
  },
];

function highlightTypos(text: string, typos: string[]): string {
  let highlighted = text;

  for (const typo of typos) {
    // Create a squiggly underline effect using Unicode characters
    const squiggly = "~".repeat(typo.length);
    const highlightedTypo = chalk.red.underline(typo) + chalk.red(squiggly);
    highlighted = highlighted.replace(
      new RegExp(`\\b${typo}\\b`, "g"),
      highlightedTypo
    );
  }

  return highlighted;
}

function displayTypoWarnings(typos: string[]): void {
  if (typos.length > 0) {
    console.log(chalk.yellow("\n⚠️  Potential typos detected:"));
    typos.forEach((typo) => {
      console.log(chalk.red(`   • ${typo} ${chalk.red("~~~~~~~~")}`));
    });
    console.log(chalk.yellow("   Please review your commit message.\n"));
  }
}

export async function promptCommit(): Promise<void> {
  console.log(chalk.bold.cyan("\n🎯 Git Commit Message Generator\n"));

  const answers = await inquirer.prompt([
    {
      name: "type",
      type: "list",
      message: "Select commit type:",
      choices: COMMIT_TYPES.map((type) => ({
        name: type.name,
        value: type.value,
        short: type.value,
      })),
      pageSize: 10,
    },
    {
      name: "scope",
      type: "input",
      message: "Enter scope (optional):",
      filter: (input: string) => input.trim(),
    },
    {
      name: "message",
      type: "input",
      message: "Enter commit message:",
      validate: (input: string) => {
        if (input.length < 10) {
          return "Message too short! Please provide at least 10 characters.";
        }
        if (input.length > 72) {
          return "Message too long! Please keep it under 72 characters for the first line.";
        }
        return true;
      },
      filter: (input: string) => input.trim(),
    },
    {
      name: "body",
      type: "input",
      message: "Enter detailed description (optional):",
      filter: (input: string) => input.trim(),
    },
    {
      name: "breaking",
      type: "confirm",
      message: "Is this a breaking change?",
      default: false,
    },
  ]);

  // Check for typos in the commit message
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

  // Display results
  console.log(chalk.bold("\n📝 Generated Commit Message:\n"));

  // Display header with color coding
  const coloredHeader = (chalk[selectedType.color] as any)(
    `${selectedType.emoji} ${commitHeader}`
  );
  console.log(coloredHeader);

  // Display body if present
  if (answers.body) {
    console.log(chalk.gray("\nBody:"));
    console.log(chalk.white(answers.body));
  }

  // Display breaking change notice
  if (answers.breaking) {
    console.log(chalk.red.bold("\n💥 BREAKING CHANGE"));
  }

  // Show typo warnings
  displayTypoWarnings(allTypos);

  // Show message with typos highlighted
  if (allTypos.length > 0) {
    console.log(chalk.yellow("Message with typos highlighted:"));
    const highlightedMessage = highlightTypos(answers.message, typos);
    const highlightedBody = answers.body
      ? highlightTypos(answers.body, bodyTypos)
      : "";

    console.log(
      (chalk[selectedType.color] as any)(
        `${selectedType.emoji} ${answers.type}${scope}${breakingPrefix}: ${highlightedMessage}`
      )
    );

    if (highlightedBody) {
      console.log(chalk.gray("\nBody:"));
      console.log(highlightedBody);
    }
  }

  // Ask for confirmation
  const { confirm } = await inquirer.prompt([
    {
      name: "confirm",
      type: "confirm",
      message:
        allTypos.length > 0
          ? "Do you want to proceed with this commit message despite potential typos?"
          : "Do you want to use this commit message?",
      default: allTypos.length === 0,
    },
  ]);

  if (confirm) {
    console.log(chalk.green("\n✅ Commit message ready to use!"));
    console.log(chalk.dim("Copy the following command:"));
    console.log(
      chalk.white.bold(
        `git commit -m "${commitHeader}"${answers.body ? ` -m "${answers.body}"` : ""}`
      )
    );
  } else {
    console.log(
      chalk.yellow(
        "\n❌ Commit cancelled. You can run the tool again to create a new message."
      )
    );
  }
}
