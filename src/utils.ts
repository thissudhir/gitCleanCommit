export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

import chalk from "chalk";
import boxen from "boxen";

export function showError(title: string, detail?: string): void {
  const body = detail ? `${chalk.red(title)}\n${chalk.dim(detail)}` : chalk.red(title);
  console.error(
    boxen(body, {
      padding: 0.5,
      margin: 0.5,
      borderColor: "red",
      borderStyle: "round",
    })
  );
}
