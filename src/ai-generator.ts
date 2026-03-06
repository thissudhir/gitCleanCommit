import { execSync } from "child_process";
import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadConfig } from "./config.js";
import chalk from "chalk";
import ora from "ora";

export class AiGenerator {
  /**
   * Get staged git changes
   */
  private static async getStagedDiff(): Promise<string> {
    try {
      return execSync("git diff --cached", { encoding: "utf8" }).trim();
    } catch (error) {
      throw new Error("Failed to get staged diff. Make sure you are in a git repository and have staged changes.");
    }
  }

  /**
   * Generate a commit message based on staged changes
   */
  public static async generateCommitMessage(): Promise<string> {
    const config = loadConfig();
    const diff = await this.getStagedDiff();

    if (!diff) {
      throw new Error("No staged changes found. Use 'git add' to stage files before generating a message.");
    }

    const provider = (process.env.GITCLEAN_AI_PROVIDER as any) || config.ai?.provider || "gemini";
    const apiKey = config.ai?.apiKey || this.getApiKeyFromEnv(provider);

    if (!apiKey) {
      const envVar = this.getEnvVarName(provider);
      throw new Error(
        `Missing API Key for ${provider}.\n` +
        `Please set the ${chalk.bold(envVar)} environment variable or add it to your ${chalk.bold(".gitclean.config.json")}.`
      );
    }

    const spinner = ora(chalk.blue("Generating commit message...")).start();

    try {
      let message = "";
      if (provider === "gemini") {
        message = await this.generateWithGemini(diff, apiKey, config.ai?.model || "gemini-1.5-flash");
      } else {
        message = await this.generateWithOpenAICompatible(diff, apiKey, provider, config.ai?.model, config.ai?.baseURL);
      }

      spinner.succeed("AI Generation successful!");

      // Basic cleaning of the response
      return message.trim().replace(/^['"`]|['"`]$/g, "");
    } catch (error) {
      spinner.fail("AI Generation failed");
      if (error instanceof Error) {
        throw new Error(`AI Provider Error: ${error.message}`);
      }
      throw error;
    }
  }

  private static getApiKeyFromEnv(provider: string): string | undefined {
    switch (provider) {
      case "gemini": return process.env.GEMINI_API_KEY;
      case "openai": return process.env.OPENAI_API_KEY;
      case "deepseek": return process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
      default: return process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    }
  }

  private static getEnvVarName(provider: string): string {
    switch (provider) {
      case "gemini": return "GEMINI_API_KEY";
      case "openai": return "OPENAI_API_KEY";
      case "deepseek": return "DEEPSEEK_API_KEY";
      default: return "AI_API_KEY";
    }
  }

  private static getPrompt(diff: string): string {
    // Keep it short to minimize token usage and latency
    return `Generate a clean, conventional commit message for the following git diff:
${diff}

Format: <TYPE>(<SCOPE>): <MESSAGE>
Available Types: ADD, FIX, UPDATE, DOCS, TEST, REMOVE
Instructions:
1. Use ONLY the types provided (all caps).
2. Scope is optional but recommended.
3. Message should be in present tense, concise, and descriptive.
4. Output ONLY the commit message string, nothing else.`;
  }

  private static async generateWithGemini(diff: string, apiKey: string, modelName: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent(this.getPrompt(diff));
    const response = await result.response;
    return response.text();
  }

  private static async generateWithOpenAICompatible(
    diff: string,
    apiKey: string,
    provider: string,
    modelName?: string,
    baseURL?: string
  ): Promise<string> {
    const defaultModels = {
      openai: "gpt-4o",
      deepseek: "deepseek-chat",
      custom: "gpt-4o"
    };

    const defaultBaseURLs = {
      openai: "https://api.openai.com/v1",
      deepseek: "https://api.deepseek.com",
      custom: undefined
    };

    const client = new OpenAI({
      apiKey,
      baseURL: baseURL || defaultBaseURLs[provider as keyof typeof defaultBaseURLs]
    });

    const completion = await client.chat.completions.create({
      model: modelName || defaultModels[provider as keyof typeof defaultModels] || "gpt-4o",
      messages: [
        { role: "system", content: "You are a professional developer helper. You generate clean conventional commit messages." },
        { role: "user", content: this.getPrompt(diff) }
      ],
      temperature: 0.2, // Lower temperature for more consistent formatting
    });

    return completion.choices[0].message.content || "";
  }
}
