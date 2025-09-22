import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { homedir } from "os";
import { CommitAnswers, GitCleanError } from "../types/index.js";
import { CacheManager } from "../cache/cache-manager.js";
import chalk from "chalk";

export interface GitCleanPlugin {
  name: string;
  version: string;
  description: string;
  author?: string;
  enabled: boolean;
  hooks: PluginHooks;
  config?: PluginConfig;
}

export interface PluginHooks {
  beforeCommit?: (message: string, answers: CommitAnswers) => Promise<string>;
  afterCommit?: (hash: string, answers: CommitAnswers) => Promise<void>;
  beforePush?: (branch: string) => Promise<boolean>;
  afterPush?: (branch: string) => Promise<void>;
  onConfigChange?: (config: any) => Promise<void>;
  onSpellCheck?: (word: string, suggestions: string[]) => Promise<string[]>;
  onMessageValidation?: (message: string) => Promise<ValidationResult>;
  onFileAnalysis?: (files: string[]) => Promise<AnalysisResult>;
}

export interface PluginConfig {
  [key: string]: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface AnalysisResult {
  suggestedType?: string;
  suggestedScope?: string;
  confidence: number;
  reasons: string[];
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  main: string;
  gitclean: {
    minVersion: string;
    hooks?: string[];
  };
  config?: {
    schema: object;
    defaults: object;
  };
}

export class PluginManager {
  private static readonly PLUGIN_DIRS = [
    join(homedir(), '.gitclean', 'plugins'),
    join(process.cwd(), '.gitclean', 'plugins'),
    join(process.cwd(), 'node_modules', '@gitclean')
  ];

  private static plugins: Map<string, GitCleanPlugin> = new Map();
  private static initialized = false;

  public static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadPlugins();
      this.initialized = true;
    } catch (error) {
      console.warn(chalk.yellow('Warning: Failed to initialize plugin system'), error);
    }
  }

  private static async loadPlugins(): Promise<void> {
    for (const pluginDir of this.PLUGIN_DIRS) {
      if (!existsSync(pluginDir)) continue;

      try {
        const entries = readdirSync(pluginDir);

        for (const entry of entries) {
          const pluginPath = join(pluginDir, entry);
          const stat = statSync(pluginPath);

          if (stat.isDirectory()) {
            await this.loadPlugin(pluginPath);
          }
        }
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Failed to scan plugin directory: ${pluginDir}`));
      }
    }
  }

  private static async loadPlugin(pluginPath: string): Promise<void> {
    try {
      // Load plugin manifest
      const manifestPath = join(pluginPath, 'package.json');
      if (!existsSync(manifestPath)) {
        return; // Skip if no manifest
      }

      const manifestContent = readFileSync(manifestPath, 'utf8');
      const manifest: any = JSON.parse(manifestContent);

      // Validate manifest
      if (!this.validateManifest(manifest)) {
        console.warn(chalk.yellow(`Warning: Invalid plugin manifest: ${manifest.name || 'unknown'}`));
        return;
      }

      const validManifest = manifest as PluginManifest;

      // Check if plugin is cached and up to date
      const cacheKey = `plugin:${validManifest.name}:${validManifest.version}`;
      let plugin = CacheManager.get<GitCleanPlugin>('plugins', cacheKey);

      if (!plugin) {
        // Load plugin module
        const mainPath = join(pluginPath, validManifest.main);
        if (!existsSync(mainPath)) {
          console.warn(chalk.yellow(`Warning: Plugin main file not found: ${mainPath}`));
          return;
        }

        // Dynamic import of plugin
        const pluginModule = await this.importPlugin(mainPath);
        if (!pluginModule || typeof pluginModule.default !== 'object') {
          console.warn(chalk.yellow(`Warning: Invalid plugin export: ${validManifest.name}`));
          return;
        }

        plugin = {
          name: validManifest.name,
          version: validManifest.version,
          description: validManifest.description,
          author: validManifest.author,
          enabled: true,
          hooks: pluginModule.default.hooks || {},
          config: validManifest.config?.defaults || {}
        };

        // Cache the loaded plugin
        CacheManager.set('plugins', cacheKey, plugin, { ttl: 60 * 60 * 1000 }); // 1 hour
      }

      this.plugins.set(validManifest.name, plugin);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Failed to load plugin at ${pluginPath}:`), error);
    }
  }

  private static validateManifest(manifest: any): manifest is PluginManifest {
    return (
      typeof manifest.name === 'string' &&
      typeof manifest.version === 'string' &&
      typeof manifest.description === 'string' &&
      typeof manifest.main === 'string' &&
      manifest.gitclean &&
      typeof manifest.gitclean.minVersion === 'string'
    );
  }

  private static async importPlugin(pluginPath: string): Promise<any> {
    try {
      // Handle both .js and .ts files
      const ext = extname(pluginPath);
      if (ext === '.ts') {
        // For TypeScript plugins, we'd need ts-node or compilation
        console.warn(chalk.yellow(`Warning: TypeScript plugins not supported yet: ${pluginPath}`));
        return null;
      }

      // Dynamic import for ES modules
      return await import(pluginPath);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Failed to import plugin: ${pluginPath}`), error);
      return null;
    }
  }

  public static getPlugin(name: string): GitCleanPlugin | undefined {
    return this.plugins.get(name);
  }

  public static getAllPlugins(): GitCleanPlugin[] {
    return Array.from(this.plugins.values());
  }

  public static getEnabledPlugins(): GitCleanPlugin[] {
    return this.getAllPlugins().filter(p => p.enabled);
  }

  public static enablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enabled = true;
      return true;
    }
    return false;
  }

  public static disablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enabled = false;
      return true;
    }
    return false;
  }

  // Hook execution methods
  public static async executeBeforeCommitHooks(
    message: string,
    answers: CommitAnswers
  ): Promise<string> {
    let modifiedMessage = message;

    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.beforeCommit) {
        try {
          modifiedMessage = await plugin.hooks.beforeCommit(modifiedMessage, answers);
        } catch (error) {
          console.warn(chalk.yellow(`Warning: Plugin beforeCommit hook failed:`), error);
        }
      }
    }

    return modifiedMessage;
  }

  public static async executeAfterCommitHooks(
    hash: string,
    answers: CommitAnswers
  ): Promise<void> {
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.afterCommit) {
        try {
          await plugin.hooks.afterCommit(hash, answers);
        } catch (error) {
          console.warn(chalk.yellow(`Warning: Plugin afterCommit hook failed:`), error);
        }
      }
    }
  }

  public static async executeBeforePushHooks(branch: string): Promise<boolean> {
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.beforePush) {
        try {
          const shouldContinue = await plugin.hooks.beforePush(branch);
          if (!shouldContinue) {
            console.log(chalk.yellow(`Push cancelled by plugin`));
            return false;
          }
        } catch (error) {
          console.warn(chalk.yellow(`Warning: Plugin beforePush hook failed:`), error);
        }
      }
    }

    return true;
  }

  public static async executeAfterPushHooks(branch: string): Promise<void> {
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.afterPush) {
        try {
          await plugin.hooks.afterPush(branch);
        } catch (error) {
          console.warn(chalk.yellow(`Warning: Plugin afterPush hook failed:`), error);
        }
      }
    }
  }

  public static async executeSpellCheckHooks(
    word: string,
    suggestions: string[]
  ): Promise<string[]> {
    let modifiedSuggestions = [...suggestions];

    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onSpellCheck) {
        try {
          modifiedSuggestions = await plugin.hooks.onSpellCheck(word, modifiedSuggestions);
        } catch (error) {
          console.warn(chalk.yellow(`Warning: Plugin onSpellCheck hook failed:`), error);
        }
      }
    }

    return modifiedSuggestions;
  }

  public static async executeValidationHooks(message: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onMessageValidation) {
        try {
          const result = await plugin.hooks.onMessageValidation(message);
          results.push(result);
        } catch (error) {
          console.warn(chalk.yellow(`Warning: Plugin onMessageValidation hook failed:`), error);
        }
      }
    }

    return results;
  }

  public static async executeFileAnalysisHooks(files: string[]): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];

    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onFileAnalysis) {
        try {
          const result = await plugin.hooks.onFileAnalysis(files);
          results.push(result);
        } catch (error) {
          console.warn(chalk.yellow(`Warning: Plugin onFileAnalysis hook failed:`), error);
        }
      }
    }

    return results;
  }

  public static async updatePluginConfig(pluginName: string, config: PluginConfig): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new GitCleanError(`Plugin not found: ${pluginName}`, 'PLUGIN_NOT_FOUND');
    }

    plugin.config = { ...plugin.config, ...config };

    if (plugin.hooks.onConfigChange) {
      try {
        await plugin.hooks.onConfigChange(plugin.config);
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Plugin onConfigChange hook failed:`), error);
      }
    }
  }

  public static getPluginConfig(pluginName: string): PluginConfig | undefined {
    const plugin = this.plugins.get(pluginName);
    return plugin?.config;
  }

  public static async installPlugin(packageName: string): Promise<void> {
    try {
      const { execSync } = await import("child_process");

      console.log(chalk.blue(`Installing plugin: ${packageName}`));

      // Install via npm
      execSync(`npm install ${packageName}`, { stdio: 'inherit' });

      // Reload plugins
      await this.loadPlugins();

      console.log(chalk.green(`✅ Plugin installed: ${packageName}`));
    } catch (error) {
      throw new GitCleanError(
        `Failed to install plugin: ${packageName}`,
        'PLUGIN_INSTALL_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  public static async uninstallPlugin(packageName: string): Promise<void> {
    try {
      const { execSync } = await import("child_process");

      console.log(chalk.blue(`Uninstalling plugin: ${packageName}`));

      // Remove from plugins map
      this.plugins.delete(packageName);

      // Uninstall via npm
      execSync(`npm uninstall ${packageName}`, { stdio: 'inherit' });

      console.log(chalk.green(`✅ Plugin uninstalled: ${packageName}`));
    } catch (error) {
      throw new GitCleanError(
        `Failed to uninstall plugin: ${packageName}`,
        'PLUGIN_UNINSTALL_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  public static listPlugins(): void {
    const plugins = this.getAllPlugins();

    if (plugins.length === 0) {
      console.log(chalk.yellow('No plugins installed'));
      return;
    }

    console.log(chalk.blue.bold('📦 Installed Plugins:\n'));

    for (const plugin of plugins) {
      const status = plugin.enabled ? chalk.green('✅ enabled') : chalk.red('❌ disabled');
      console.log(chalk.white(`${plugin.name} v${plugin.version}`));
      console.log(chalk.dim(`  ${plugin.description}`));
      console.log(chalk.dim(`  Status: ${status}`));
      if (plugin.author) {
        console.log(chalk.dim(`  Author: ${plugin.author}`));
      }
      console.log('');
    }
  }

  public static createPluginTemplate(name: string, outputDir: string): void {
    const template = this.generatePluginTemplate(name);

    try {
      const { writeFileSync, mkdirSync } = require('fs');
      const pluginDir = join(outputDir, name);

      mkdirSync(pluginDir, { recursive: true });

      writeFileSync(join(pluginDir, 'package.json'), JSON.stringify(template.manifest, null, 2));
      writeFileSync(join(pluginDir, 'index.js'), template.code);
      writeFileSync(join(pluginDir, 'README.md'), template.readme);

      console.log(chalk.green(`✅ Plugin template created: ${pluginDir}`));
    } catch (error) {
      throw new GitCleanError(
        `Failed to create plugin template: ${name}`,
        'PLUGIN_TEMPLATE_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  private static generatePluginTemplate(name: string): {
    manifest: PluginManifest;
    code: string;
    readme: string;
  } {
    const manifest: PluginManifest = {
      name,
      version: '1.0.0',
      description: `A GitClean plugin for ${name}`,
      main: 'index.js',
      gitclean: {
        minVersion: '1.0.0',
        hooks: ['beforeCommit', 'afterCommit']
      }
    };

    const code = `// GitClean Plugin: ${name}

const plugin = {
  hooks: {
    async beforeCommit(message, answers) {
      // Modify commit message before commit
      console.log('${name}: Processing commit message');
      return message;
    },

    async afterCommit(hash, answers) {
      // Post-commit actions
      console.log(\`${name}: Commit \${hash} completed\`);
    },

    async beforePush(branch) {
      // Pre-push validation
      console.log(\`${name}: Checking push to \${branch}\`);
      return true; // Return false to cancel push
    },

    async onSpellCheck(word, suggestions) {
      // Enhance spell check suggestions
      return suggestions;
    },

    async onMessageValidation(message) {
      // Custom message validation
      return {
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      };
    }
  }
};

export default plugin;
`;

    const readme = `# ${name}

A GitClean plugin for enhancing commit workflows.

## Installation

\`\`\`bash
gitclean plugins install ${name}
\`\`\`

## Configuration

Add to your \`.gitclean.json\`:

\`\`\`json
{
  "plugins": {
    "${name}": {
      "enabled": true,
      "config": {
        // Plugin-specific configuration
      }
    }
  }
}
\`\`\`

## Hooks

This plugin implements the following hooks:

- \`beforeCommit\`: Modifies commit messages before commit
- \`afterCommit\`: Executes post-commit actions
- \`beforePush\`: Validates before push operations

## License

MIT
`;

    return { manifest, code, readme };
  }
}