import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { findGitRoot } from "../git-integration.js";
import { DEFAULT_CONFIG, CONFIG_FILE_NAME } from "./default-config.js";
import { GitCleanConfig, ConfigurationError } from "../types/index.js";

export class ConfigManager {
  private static cachedConfig: GitCleanConfig | null = null;
  private static configPath: string | null = null;

  /**
   * Get the configuration path for the current git repository
   */
  private static getConfigPath(): string {
    if (this.configPath) return this.configPath;
    
    try {
      const gitRoot = findGitRoot();
      this.configPath = join(gitRoot, CONFIG_FILE_NAME);
      return this.configPath;
    } catch (error) {
      // Fallback to current directory if not in git repo
      this.configPath = join(process.cwd(), CONFIG_FILE_NAME);
      return this.configPath;
    }
  }

  /**
   * Load configuration from .gitclean.json or return default config
   */
  public static loadConfig(): GitCleanConfig {
    if (this.cachedConfig) return this.cachedConfig;

    const configPath = this.getConfigPath();
    
    if (!existsSync(configPath)) {
      this.cachedConfig = { ...DEFAULT_CONFIG };
      return this.cachedConfig;
    }

    try {
      const configContent = readFileSync(configPath, 'utf8');
      const userConfig = JSON.parse(configContent) as Partial<GitCleanConfig>;
      
      // Merge with default config
      this.cachedConfig = this.mergeConfigs(DEFAULT_CONFIG, userConfig);
      return this.cachedConfig;
    } catch (error) {
      throw new ConfigurationError(
        `Failed to load configuration from ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Save configuration to .gitclean.json
   */
  public static saveConfig(config: GitCleanConfig): void {
    const configPath = this.getConfigPath();
    
    try {
      const configJson = JSON.stringify(config, null, 2);
      writeFileSync(configPath, configJson, 'utf8');
      this.cachedConfig = config;
    } catch (error) {
      throw new ConfigurationError(
        `Failed to save configuration to ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create a default configuration file
   */
  public static createDefaultConfig(): void {
    const configPath = this.getConfigPath();
    
    if (existsSync(configPath)) {
      throw new ConfigurationError(`Configuration file already exists at ${configPath}`);
    }

    this.saveConfig(DEFAULT_CONFIG);
  }

  /**
   * Reset cached configuration (useful for testing)
   */
  public static resetCache(): void {
    this.cachedConfig = null;
    this.configPath = null;
  }

  /**
   * Deep merge configurations
   */
  private static mergeConfigs(defaultConfig: GitCleanConfig, userConfig: Partial<GitCleanConfig>): GitCleanConfig {
    const merged: GitCleanConfig = { ...defaultConfig };

    if (userConfig.commitTypes) {
      merged.commitTypes = userConfig.commitTypes;
    }

    if (userConfig.spellCheck) {
      merged.spellCheck = {
        ...defaultConfig.spellCheck,
        ...userConfig.spellCheck,
      };
    }

    if (userConfig.workflow) {
      merged.workflow = {
        ...defaultConfig.workflow,
        ...userConfig.workflow,
      };
    }

    if (userConfig.templates) {
      merged.templates = userConfig.templates;
    }

    if (userConfig.preCommitHooks) {
      merged.preCommitHooks = userConfig.preCommitHooks;
    }

    return merged;
  }

  /**
   * Get current configuration path
   */
  public static getCurrentConfigPath(): string {
    return this.getConfigPath();
  }

  /**
   * Check if configuration file exists
   */
  public static configExists(): boolean {
    return existsSync(this.getConfigPath());
  }
}