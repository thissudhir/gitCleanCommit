import { execSync } from "child_process";
import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { loadConfig } from "./config.js";
import chalk from "chalk";
import ora from "ora";

// Truncate large diffs to avoid hitting token limits
const MAX_DIFF_LENGTH = 8000;

interface GitContext {
  branch: string;
  recentCommits: string;
}

export class AiGenerator {
  private static async getStagedDiff(): Promise<string> {
    try {
      return execSync("git diff --cached", { encoding: "utf8" }).trim();
    } catch {
      throw new Error("Failed to get staged diff. Make sure you are in a git repository and have staged changes.");
    }
  }

  private static getGitContext(): GitContext {
    try {
      const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
      const recentCommits = execSync("git log --oneline -5 --no-merges", { encoding: "utf8" }).trim();
      return { branch, recentCommits };
    } catch {
      return { branch: "unknown", recentCommits: "" };
    }
  }

  private static truncateDiff(diff: string): string {
    if (diff.length <= MAX_DIFF_LENGTH) return diff;
    return (
      diff.slice(0, MAX_DIFF_LENGTH) +
      `\n\n... [diff truncated — ${diff.length - MAX_DIFF_LENGTH} chars omitted]`
    );
  }

  public static async generateCommitMessage(): Promise<string> {
    const config = loadConfig();

    // Auto-stage all changes
    try {
      execSync("git add .", { stdio: "ignore" });
    } catch {
      // Ignore — not in a git repo or nothing to add
    }

    const diff = await this.getStagedDiff();
    if (!diff) {
      throw new Error("No staged changes found. Use 'git add' to stage files before generating a message.");
    }

    const providerFromEnv = process.env.GITCLEAN_AI_PROVIDER as string | undefined;
    const provider = providerFromEnv || config.ai?.provider || "gemini";
    // If provider is overridden via env, the config model belongs to a different provider — ignore it
    const model = process.env.GITCLEAN_AI_MODEL || (providerFromEnv ? undefined : config.ai?.model);
    const apiKey = config.ai?.apiKey || this.getApiKeyFromEnv(provider);

    // Ollama runs locally — no API key required
    if (!apiKey && provider !== "ollama") {
      const envVar = this.getEnvVarName(provider);
      throw new Error(
        `Missing API key for ${provider}.\n` +
        `Set ${chalk.bold(envVar)} in your environment or add ${chalk.bold("apiKey")} to ${chalk.bold(".gitclean.config.json")}.`
      );
    }

    const spinner = ora(chalk.blue(`Generating commit message with ${provider}...`)).start();

    try {
      const context = this.getGitContext();
      const truncatedDiff = this.truncateDiff(diff);
      let message = "";

      if (provider === "gemini") {
        message = await this.generateWithGemini(
          truncatedDiff, apiKey!, model || "gemini-1.5-flash", context
        );
      } else if (provider === "anthropic") {
        message = await this.generateWithAnthropic(
          truncatedDiff, apiKey!, model || "claude-3-5-haiku-20241022", context
        );
      } else {
        message = await this.generateWithOpenAICompatible(
          truncatedDiff, apiKey || "ollama", provider, model, config.ai?.baseURL, context
        );
      }

      spinner.succeed("AI generation successful!");
      return message.trim().replace(/^['"`]|['"`]$/g, "");
    } catch (error) {
      spinner.fail("AI generation failed");
      if (error instanceof Error) {
        throw new Error(`AI Provider Error: ${error.message}`);
      }
      throw error;
    }
  }

  private static getApiKeyFromEnv(provider: string): string | undefined {
    switch (provider) {
      case "gemini":    return process.env.GEMINI_API_KEY;
      case "openai":    return process.env.OPENAI_API_KEY;
      case "deepseek":  return process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
      case "anthropic": return process.env.ANTHROPIC_API_KEY;
      case "groq":      return process.env.GROQ_API_KEY;
      case "ollama":    return undefined; // No key needed for local Ollama
      default:          return process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    }
  }

  private static getEnvVarName(provider: string): string {
    switch (provider) {
      case "gemini":    return "GEMINI_API_KEY";
      case "openai":    return "OPENAI_API_KEY";
      case "deepseek":  return "DEEPSEEK_API_KEY";
      case "anthropic": return "ANTHROPIC_API_KEY";
      case "groq":      return "GROQ_API_KEY";
      default:          return "AI_API_KEY";
    }
  }

  private static buildPrompt(diff: string, context: GitContext): string {
    const contextSection = context.recentCommits
      ? `\nBranch: ${context.branch}\nRecent commits (for style reference):\n${context.recentCommits}\n`
      : `\nBranch: ${context.branch}\n`;

    return `Generate a clean, conventional commit message for the following git diff.
${contextSection}
Git Diff:
${diff}

Format: <TYPE>(<SCOPE>): <MESSAGE>
Available Types: ADD, FIX, UPDATE, DOCS, TEST, REMOVE

Instructions:
1. Use ONLY the types listed above (all caps).
2. Scope is optional but recommended — infer it from the changed files.
3. Message should be present tense, concise, and descriptive.
4. Match the style and tone of the recent commits shown above.
5. Output ONLY the commit message string, nothing else.`;
  }

  private static async generateWithGemini(
    diff: string,
    apiKey: string,
    modelName: string,
    context: GitContext
  ): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(this.buildPrompt(diff, context));
    return result.response.text();
  }

  private static async generateWithAnthropic(
    diff: string,
    apiKey: string,
    modelName: string,
    context: GitContext
  ): Promise<string> {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: modelName,
      max_tokens: 256,
      system: "You are a professional developer assistant. You generate clean, conventional commit messages. Output only the commit message string — no explanations, no markdown.",
      messages: [{ role: "user", content: this.buildPrompt(diff, context) }],
    });
    const block = message.content[0];
    return block.type === "text" ? block.text : "";
  }

  private static async generateWithOpenAICompatible(
    diff: string,
    apiKey: string,
    provider: string,
    modelName?: string,
    baseURL?: string,
    context: GitContext = { branch: "unknown", recentCommits: "" }
  ): Promise<string> {
    // Presets for common providers — all use OpenAI-compatible APIs
    const presets: Record<string, { model: string; baseURL: string }> = {
      openai:   { model: "gpt-4o-mini",              baseURL: "https://api.openai.com/v1" },
      deepseek: { model: "deepseek-chat",             baseURL: "https://api.deepseek.com" },
      groq:     { model: "llama-3.1-8b-instant",      baseURL: "https://api.groq.com/openai/v1" },
      ollama:   { model: "llama3.2",                  baseURL: "http://localhost:11434/v1" },
      custom:   { model: "gpt-4o-mini",               baseURL: "" },
    };

    const preset = presets[provider] || presets.custom;

    const client = new OpenAI({
      apiKey,
      baseURL: baseURL || preset.baseURL || undefined,
    });

    const completion = await client.chat.completions.create({
      model: modelName || preset.model,
      messages: [
        {
          role: "system",
          content: "You are a professional developer assistant. You generate clean, conventional commit messages. Output only the commit message string — no explanations, no markdown.",
        },
        { role: "user", content: this.buildPrompt(diff, context) },
      ],
      temperature: 0.2,
      max_tokens: 256,
    });

    return completion.choices[0].message.content || "";
  }
}
