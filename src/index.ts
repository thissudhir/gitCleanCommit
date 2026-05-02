#!/usr/bin/env node

import { Command } from "commander";
import { createRequire } from "module";
import { registerHooksCommands } from "./commands/hooks.js";
import { registerCommitCommands, registerDefaultAction } from "./commands/commit.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerSpellCheckCommands } from "./commands/spellcheck.js";

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

const program = new Command();

program
  .name("gitclean")
  .description("Clean, conventional commits made easy")
  .version(version, "-v, --version", "Show version information");

registerHooksCommands(program);
registerCommitCommands(program);
registerConfigCommands(program);
registerSpellCheckCommands(program);
registerDefaultAction(program);

program.parse();
