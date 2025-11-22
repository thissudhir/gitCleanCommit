import Typo from "typo-js";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

export interface SpellCheckResult {
  word: string;
  suggestions: string[];
  isCorrect: boolean;
  position: { start: number; end: number };
}

export class GitCleanSpellChecker {
  private static dictionary: Typo | null = null;
  private static isInitialized = false;

  private static readonly TECHNICAL_WORDS = new Set([
    // Programming languages & frameworks
    "api",
    "cli",
    "ui",
    "ux",
    "dom",
    "json",
    "xml",
    "html",
    "css",
    "js",
    "ts",
    "npm",
    "yarn",
    "pnpm",
    "webpack",
    "vite",
    "rollup",
    "babel",
    "eslint",
    "prettier",
    "typescript",
    "javascript",
    "node",
    "nodejs",
    "react",
    "vue",
    "angular",
    "svelte",
    "scss",
    "sass",
    "less",
    "tailwind",
    "bootstrap",
    "css3",
    "html5",
    "jsx",
    "tsx",

    // Git & Version Control
    "git",
    "github",
    "gitlab",
    "bitbucket",
    "commit",
    "push",
    "pull",
    "merge",
    "rebase",
    "checkout",
    "branch",
    "tag",
    "stash",
    "clone",
    "fork",
    "upstream",
    "origin",
    "remote",
    "gitignore",
    "gitconfig",
    "gitflow",
    "pr",
    "mr",
    "repo",
    "repository",
    "submodule",
    "workflow",
    "actions",
    "hooks",
    "changelog",
    "semver",

    // DevOps & Cloud
    "docker",
    "kubernetes",
    "k8s",
    "aws",
    "azure",
    "gcp",
    "vercel",
    "netlify",
    "heroku",
    "ci",
    "cd",
    "devops",
    "oauth",
    "jwt",
    "cors",
    "csrf",
    "ssl",
    "tls",
    "nginx",
    "apache",
    "kubernetes",
    "helm",
    "terraform",
    "ansible",
    "jenkins",

    // Protocols & Networks
    "http",
    "https",
    "tcp",
    "udp",
    "ssh",
    "ftp",
    "smtp",
    "pop3",
    "imap",
    "dns",
    "url",
    "uri",
    "uuid",
    "regex",
    "websocket",
    "graphql",
    "rest",
    "soap",
    "grpc",

    // Databases
    "sql",
    "nosql",
    "mongodb",
    "mysql",
    "postgresql",
    "sqlite",
    "redis",
    "elasticsearch",
    "firebase",
    "supabase",
    "prisma",
    "orm",
    "crud",
    "db",

    // Architecture & Patterns
    "microservices",
    "monolith",
    "serverless",
    "jamstack",
    "spa",
    "ssr",
    "ssg",
    "pwa",
    "mvc",
    "mvp",
    "mvvm",
    "api",
    "sdk",
    "cli",
    "gui",
    "microservice",

    // Tech concepts
    "blockchain",
    "cryptocurrency",
    "ai",
    "ml",
    "nlp",
    "iot",
    "ar",
    "vr",
    "refactor",
    "refactoring",
    "optimization",
    "minification",
    "bundling",
    "transpilation",
    "polyfill",
    "shim",
    "middleware",
    "plugin",
    "addon",

    // File formats & configs
    "md",
    "txt",
    "log",
    "yml",
    "yaml",
    "toml",
    "ini",
    "cfg",
    "conf",
    "env",
    "dockerfile",
    "makefile",
    "rakefile",
    "gemfile",
    "procfile",
    "lockfile",

    // Development terms
    "config",
    "env",
    "prod",
    "dev",
    "staging",
    "localhost",
    "async",
    "await",
    "promise",
    "callback",
    "event",
    "listener",
    "handler",
    "component",
    "module",
    "package",
    "library",
    "framework",
    "boilerplate",
    "template",
    "scaffold",
    "generator",
    "linter",
    "formatter",
    "transpiler",
    "compiler",

    // Common abbreviations
    "app",
    "db",
    "auth",
    "util",
    "utils",
    "lib",
    "libs",
    "src",
    "dist",
    "build",
    "bin",
    "test",
    "spec",
    "mock",
    "stub",
    "tmp",
    "temp",
    "www",
    "admin",
    "user",
    "users",
    "client",
    "server",
    "backend",
    "frontend",
    "fullstack",
    "deployment",
    "infrastructure",
    "monitoring",
    "logging",
    "analytics",
    "metrics",
    "dashboard",
    "sidebar",
    "navbar",
    "footer",
    "header",
    "modal",
    "popup",
    "tooltip",
    "dropdown",
    "carousel",
    "accordion",
    "tabs",
    "pagination",
    "breadcrumb",
    "stepper",
    "wizard",

    // Package managers & tools
    "homebrew",
    "chocolatey",
    "apt",
    "yum",
    "pacman",
    "conda",
    "pip",
    "gem",
    "composer",
    "maven",
    "gradle",
    "nuget",
    "cargo",
    "go",

    // Testing
    "jest",
    "mocha",
    "chai",
    "cypress",
    "selenium",
    "puppeteer",
    "playwright",
    "vitest",
    "karma",
    "jasmine",
    "enzyme",
    "testing",
    "unittest",
    "e2e",
  ]);

  private static readonly COMMON_TYPOS = new Map([
    // Basic typos
    ["teh", "the"],
    ["hte", "the"],
    ["adn", "and"],
    ["nad", "and"],
    ["recieve", "receive"],
    ["recieved", "received"],
    ["recieving", "receiving"],
    ["seperate", "separate"],
    ["seperated", "separated"],
    ["seperately", "separately"],
    ["definately", "definitely"],
    ["occured", "occurred"],
    ["occuring", "occurring"],
    ["perfomance", "performance"],
    ["perfom", "perform"],
    ["sucessful", "successful"],
    ["sucessfully", "successfully"],
    ["acording", "according"],
    ["adress", "address"],
    ["begining", "beginning"],
    ["beleive", "believe"],
    ["buiness", "business"],
    ["diference", "difference"],
    ["enviroment", "environment"],
    ["existance", "existence"],
    ["finaly", "finally"],
    ["foriegn", "foreign"],
    ["goverment", "government"],
    ["gaurd", "guard"],
    ["happend", "happened"],
    ["immediatly", "immediately"],
    ["independant", "independent"],
    ["intrested", "interested"],
    ["libary", "library"],
    ["maintainance", "maintenance"],
    ["occassion", "occasion"],
    ["prefered", "preferred"],
    ["reccomend", "recommend"],
    ["thier", "their"],
    ["truely", "truly"],
    ["usualy", "usually"],
    ["wierd", "weird"],
    ["calender", "calendar"],
    ["accomodate", "accommodate"],
    ["achive", "achieve"],
    ["achived", "achieved"],

    // Programming-specific typos
    ["commited", "committed"],
    ["commiting", "committing"],
    ["committ", "commit"],
    ["implmentation", "implementation"],
    ["implimentation", "implementation"],
    ["documention", "documentation"],
    ["confguration", "configuration"],
    ["configuraton", "configuration"],
    ["functionallity", "functionality"],
    ["conditon", "condition"],
    ["lenght", "length"],
    ["widht", "width"],
    ["heigth", "height"],
    ["compatability", "compatibility"],
    ["dependancy", "dependency"],
    ["optmize", "optimize"],
    ["optmized", "optimized"],
    ["optmization", "optimization"],
    ["intialize", "initialize"],
    ["intializing", "initializing"],
    ["intial", "initial"],
    ["retrun", "return"],
    ["reutrn", "return"],
    ["funciton", "function"],
    ["fucntion", "function"],
    ["fucntions", "functions"],
    ["valriable", "variable"],
    ["varaible", "variable"],
    ["varibles", "variables"],
    ["methdo", "method"],
    ["methos", "method"],
    ["classs", "class"],
    ["clases", "classes"],
    ["contructor", "constructor"],
    ["contsructor", "constructor"],
    ["compnent", "component"],
    ["componnet", "component"],
    ["compoent", "component"],
    ["reponse", "response"],
    ["respone", "response"],
    ["reqeust", "request"],
    ["requst", "request"],
    ["databse", "database"],
    ["datbase", "database"],
    ["serivce", "service"],
    ["servie", "service"],
    ["handlr", "handler"],
    ["handleer", "handler"],
    ["listner", "listener"],
    ["lsitener", "listener"],
    ["connecton", "connection"],
    ["conection", "connection"],
    ["authetication", "authentication"],
    ["athentication", "authentication"],
    ["validaton", "validation"],
    ["valiation", "validation"],
    ["authentification", "authentication"],
    ["authroization", "authorization"],
    ["bugfixes", "bug fixes"],
    ["hotfixes", "hot fixes"],
    ["updat", "update"],
    ["updte", "update"],
    ["udpate", "update"],
    ["tsting", "testing"],
    ["tesitng", "testing"],
    ["testig", "testing"],
  ]);

  public static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize with built-in English dictionary
      // typo-js comes with en_US dictionary built-in
      this.dictionary = new Typo("en_US");
      this.isInitialized = true;
      console.log("Spell checker initialized successfully");
    } catch (error) {
      console.warn(
        "Warning: Could not initialize full dictionary. Using fallback mode."
      );
      this.isInitialized = true; // Continue with typo detection only
    }
  }

  public static async checkSpelling(
    message: string
  ): Promise<SpellCheckResult[]> {
    await this.initialize();

    const results: SpellCheckResult[] = [];
    const words = this.extractWords(message);

    for (const { word, start, end } of words) {
      const lowerWord = word.toLowerCase();

      // Skip very short words (1-2 chars), numbers, and single letters
      if (word.length <= 2 || /^\d+$/.test(word) || /^[a-z]$/i.test(word)) {
        continue;
      }

      // Skip technical terms and common abbreviations
      if (this.TECHNICAL_WORDS.has(lowerWord)) {
        continue;
      }

      // Check if it's a common typo first (highest priority)
      if (this.COMMON_TYPOS.has(lowerWord)) {
        results.push({
          word,
          suggestions: [this.COMMON_TYPOS.get(lowerWord)!],
          isCorrect: false,
          position: { start, end },
        });
        continue;
      }

      // Use typo-js dictionary if available
      if (this.dictionary) {
        const isCorrect = this.dictionary.check(word);

        if (!isCorrect) {
          const suggestions = this.dictionary.suggest(word).slice(0, 3);
          results.push({
            word,
            suggestions: suggestions || [],
            isCorrect: false,
            position: { start, end },
          });
        }
      }
    }

    return results;
  }

  private static extractWords(
    text: string
  ): Array<{ word: string; start: number; end: number }> {
    const words: Array<{ word: string; start: number; end: number }> = [];
    const wordRegex = /\b[a-zA-Z]+\b/g;
    let match;

    while ((match = wordRegex.exec(text)) !== null) {
      words.push({
        word: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    return words;
  }

  public static createSquigglyUnderline(
    text: string,
    errors: SpellCheckResult[]
  ): string {
    if (errors.length === 0) return text;

    let result = text;

    // Sort errors by position (descending) to avoid index shifting issues
    const sortedErrors = errors.sort(
      (a, b) => b.position.start - a.position.start
    );

    for (const error of sortedErrors) {
      const { word, position } = error;
      const beforeWord = result.substring(0, position.start);
      const afterWord = result.substring(position.end);

      // Create red text with underline using ANSI codes
      const squigglyWord = `\x1b[31m\x1b[4m${word}\x1b[0m`;
      result = beforeWord + squigglyWord + afterWord;
    }

    return result;
  }

  public static getAutoCorrection(word: string): string | null {
    const lowerWord = word.toLowerCase();

    // Check common typos first (fastest and most accurate)
    if (this.COMMON_TYPOS.has(lowerWord)) {
      return this.COMMON_TYPOS.get(lowerWord)!;
    }

    // Use typo-js dictionary if available
    if (this.dictionary) {
      const suggestions = this.dictionary.suggest(word);
      return suggestions && suggestions.length > 0 ? suggestions[0] : null;
    }

    return null;
  }

  public static async autoCorrectText(text: string): Promise<string> {
    const errors = await this.checkSpelling(text);
    let correctedText = text;

    // Sort errors by position (descending) to avoid index shifting issues
    const sortedErrors = errors.sort(
      (a, b) => b.position.start - a.position.start
    );

    for (const error of sortedErrors) {
      if (error.suggestions.length > 0) {
        const { position } = error;
        const beforeWord = correctedText.substring(0, position.start);
        const afterWord = correctedText.substring(position.end);

        correctedText = beforeWord + error.suggestions[0] + afterWord;
      }
    }

    return correctedText;
  }

  public static getSpellCheckStats(): {
    isInitialized: boolean;
    hasDictionary: boolean;
    technicalWordsCount: number;
    typoRulesCount: number;
  } {
    return {
      isInitialized: this.isInitialized,
      hasDictionary: this.dictionary !== null,
      technicalWordsCount: this.TECHNICAL_WORDS.size,
      typoRulesCount: this.COMMON_TYPOS.size,
    };
  }
}

// Legacy functions for backward compatibility
export async function checkSpelling(message: string): Promise<string[]> {
  const results = await GitCleanSpellChecker.checkSpelling(message);
  return results.map((result) => result.word);
}

export function getSuggestion(word: string): string | null {
  return GitCleanSpellChecker.getAutoCorrection(word);
}
