import figlet from "figlet";
import chalk from "chalk";

export function showBanner(mode?: "ai"): void {
  const terminalWidth = process.stdout.columns || 80;

  const fullText = mode === "ai" ? "GitClean AI" : "GitClean";
  const shortText = mode === "ai" ? "GC AI" : "GC";
  const subtitle = mode === "ai"
    ? chalk.cyan("AI-powered conventional commits\n")
    : chalk.dim("Clean, conventional commits made easy\n");

  const fullBanner = figlet.textSync(fullText, {
    font: "ANSI Shadow",
    horizontalLayout: "default",
    verticalLayout: "default",
  });

  const bannerWidth = Math.max(...fullBanner.split("\n").map(line => line.length));
  const safetyMargin = 4;

  if (terminalWidth < (bannerWidth + safetyMargin)) {
    console.log(
      chalk.whiteBright(
        figlet.textSync(shortText, {
          font: "ANSI Shadow",
          horizontalLayout: "default",
          verticalLayout: "default",
        })
      )
    );
  } else {
    console.log(chalk.whiteBright(fullBanner));
  }
  console.log(subtitle);
}
