import figlet from "figlet";
import chalk from "chalk";

export function showBanner(): void {
  console.log(
    chalk.whiteBright(
      figlet.textSync("GitClean", {
        font: "ANSI Shadow",
        horizontalLayout: "default",
        verticalLayout: "default",
      })
    )
  );
  console.log(chalk.dim("  Clean, conventional commits made easy\n"));
}
