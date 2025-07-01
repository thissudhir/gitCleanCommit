import inquirer from "inquirer";
import chalk from "chalk";

export async function promptCommit(): Promise<void> {
  const answers = await inquirer.prompt([
    {
      name: "type",
      type: "list",
      message: "Select commit type:",
      choices: ["feat", "fix", "docs", "style", "refactor", "test", "chore"],
    },
    {
      name: "scope",
      type: "input",
      message: "Enter scope (optional):",
    },
    {
      name: "message",
      type: "input",
      message: "Enter commit message:",
      validate: (input: string) => {
        return input.length < 10 ? "Message too short!" : true;
      },
    },
  ]);

  const commit = `${answers.type}${answers.scope ? `(${answers.scope})` : ""}: ${answers.message}`;
  console.log(chalk.green("\nGenerated commit message:"));
  console.log(chalk.blue(commit));
}
