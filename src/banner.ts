import figlet from "figlet";
import chalk from "chalk";

export function showBanner(): void {
  // Get terminal width, default to 80 if not available
  const terminalWidth = process.stdout.columns || 80;
  
  // Generate the full banner text to measure its width
  const fullBanner = figlet.textSync("GitClean", {
    font: "ANSI Shadow",
    horizontalLayout: "default",
    verticalLayout: "default",
  });
  
  // Calculate the actual width of the banner
  const bannerLines = fullBanner.split("\n");
  const bannerWidth = Math.max(...bannerLines.map(line => line.length));
  
  // Add a small safety margin (2 chars on each side)
  const safetyMargin = 4;
  
  // Show smaller "GC" banner if terminal is too narrow for the full banner
  if (terminalWidth < (bannerWidth + safetyMargin)) {
    console.log(
      chalk.whiteBright(
        figlet.textSync("GC", {
          font: "ANSI Shadow",
          horizontalLayout: "default",
          verticalLayout: "default",
        })
      )
    );
  } else {
    console.log(chalk.whiteBright(fullBanner));
  }
  console.log(chalk.dim("  Clean, conventional commits made easy\n"));
}
