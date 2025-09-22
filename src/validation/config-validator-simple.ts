import { GitCleanConfig, ConfigurationError } from "../types/index.js";
import { readFileSync, existsSync } from "fs";
import chalk from "chalk";
import boxen from "boxen";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export class ConfigValidator {
  private static readonly VALID_COMMIT_TYPES = [
    'feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'build', 'ci', 'perf', 'revert'
  ];

  public static validateConfig(config: GitCleanConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Validate commit types
      if (config.commitTypes) {
        this.validateCommitTypes(config.commitTypes, errors, warnings);
      }

      // Validate spell check configuration
      if (config.spellCheck) {
        this.validateSpellCheck(config.spellCheck, errors, warnings, suggestions);
      }

      // Validate workflow configuration
      if (config.workflow) {
        this.validateWorkflow(config.workflow, warnings, suggestions);
      }

      // Validate templates
      if (config.templates) {
        this.validateTemplates(config.templates, errors, warnings);
      }

      // General suggestions
      this.addGeneralSuggestions(config, suggestions);

    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  private static validateCommitTypes(commitTypes: any[], errors: string[], warnings: string[]): void {
    if (!Array.isArray(commitTypes)) {
      errors.push('commitTypes must be an array');
      return;
    }

    const typeValues = commitTypes.map(t => t?.value).filter(Boolean);
    const duplicateTypes = typeValues.filter((type, index) => typeValues.indexOf(type) !== index);

    if (duplicateTypes.length > 0) {
      errors.push(`Duplicate commit types found: ${duplicateTypes.join(', ')}`);
    }

    commitTypes.forEach((type, index) => {
      if (!type.name || !type.value || !type.description) {
        errors.push(`commitTypes[${index}] is missing required fields (name, value, description)`);
      }

      if (type.value && !this.VALID_COMMIT_TYPES.includes(type.value)) {
        warnings.push(`'${type.value}' is not a conventional commit type`);
      }
    });
  }

  private static validateSpellCheck(spellCheck: any, errors: string[], warnings: string[], suggestions: string[]): void {
    if (typeof spellCheck !== 'object') {
      errors.push('spellCheck must be an object');
      return;
    }

    if (spellCheck.debounceMs !== undefined) {
      if (typeof spellCheck.debounceMs !== 'number' || spellCheck.debounceMs < 50 || spellCheck.debounceMs > 2000) {
        errors.push('spellCheck.debounceMs must be a number between 50 and 2000');
      } else if (spellCheck.debounceMs < 100) {
        suggestions.push('Consider increasing debounceMs to 200+ for better performance');
      }
    }

    if (spellCheck.customWords && !Array.isArray(spellCheck.customWords)) {
      errors.push('spellCheck.customWords must be an array');
    }

    if (spellCheck.disabledWords && !Array.isArray(spellCheck.disabledWords)) {
      errors.push('spellCheck.disabledWords must be an array');
    }

    if (spellCheck.customWords && spellCheck.disabledWords) {
      const overlap = spellCheck.customWords.filter((word: string) =>
        spellCheck.disabledWords.includes(word)
      );
      if (overlap.length > 0) {
        warnings.push(`Words appear in both customWords and disabledWords: ${overlap.join(', ')}`);
      }
    }
  }

  private static validateWorkflow(workflow: any, warnings: string[], suggestions: string[]): void {
    if (typeof workflow !== 'object') {
      warnings.push('workflow must be an object');
      return;
    }

    if (workflow.addFiles && Array.isArray(workflow.addFiles)) {
      const hasRiskyPatterns = workflow.addFiles.some((pattern: string) =>
        pattern.includes('**/') || pattern === '.' || pattern.includes('node_modules')
      );
      if (hasRiskyPatterns) {
        warnings.push('Detected potentially risky file patterns in workflow.addFiles');
      }
    }

    if (workflow.autoPush && !workflow.autoAdd) {
      suggestions.push('Enable autoAdd when using autoPush for complete automation');
    }
  }

  private static validateTemplates(templates: any[], errors: string[], warnings: string[]): void {
    if (!Array.isArray(templates)) {
      errors.push('templates must be an array');
      return;
    }

    const templateNames = templates.map(t => t?.name).filter(Boolean);
    const duplicateNames = templateNames.filter((name, index) => templateNames.indexOf(name) !== index);

    if (duplicateNames.length > 0) {
      errors.push(`Duplicate template names found: ${duplicateNames.join(', ')}`);
    }

    templates.forEach((template, index) => {
      if (!template.name || !template.type || !template.message) {
        errors.push(`templates[${index}] is missing required fields (name, type, message)`);
      }

      if (template.type && !this.VALID_COMMIT_TYPES.includes(template.type)) {
        warnings.push(`Template type '${template.type}' is not a conventional commit type`);
      }
    });
  }

  private static addGeneralSuggestions(config: GitCleanConfig, suggestions: string[]): void {
    if (!config.spellCheck?.enabled) {
      suggestions.push('Enable spell checking to improve commit message quality');
    }

    if (!config.templates || config.templates.length === 0) {
      suggestions.push('Consider adding commit templates for common scenarios');
    }
  }

  public static validateConfigFile(configPath: string): ValidationResult {
    try {
      if (!existsSync(configPath)) {
        return {
          isValid: false,
          errors: ['Configuration file does not exist'],
          warnings: [],
          suggestions: ['Run "gitclean config --init" to create a default configuration file']
        };
      }

      const configContent = readFileSync(configPath, 'utf8');
      let config: GitCleanConfig;

      try {
        config = JSON.parse(configContent);
      } catch (parseError) {
        return {
          isValid: false,
          errors: [`Invalid JSON: ${parseError instanceof Error ? parseError.message : 'Parse error'}`],
          warnings: [],
          suggestions: ['Check JSON syntax and ensure all quotes and brackets are properly closed']
        };
      }

      return this.validateConfig(config);
    } catch (error) {
      throw new ConfigurationError(
        `Failed to validate config file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  public static displayValidationResult(result: ValidationResult): void {
    if (result.isValid) {
      console.log(
        boxen(
          chalk.green.bold("✅ Configuration Valid\n\n") +
          chalk.dim("Your GitClean configuration is valid and ready to use!") +
          (result.suggestions.length > 0 ?
            chalk.yellow("\n\n💡 Suggestions:\n") +
            result.suggestions.map(s => chalk.dim(`• ${s}`)).join('\n')
            : ""),
          {
            padding: 1,
            margin: 1,
            borderStyle: "round",
            borderColor: "green"
          }
        )
      );
    } else {
      console.log(
        boxen(
          chalk.red.bold("❌ Configuration Invalid\n\n") +
          chalk.yellow("Errors:\n") +
          result.errors.map(e => chalk.red(`• ${e}`)).join('\n') +
          (result.warnings.length > 0 ?
            chalk.yellow("\n\nWarnings:\n") +
            result.warnings.map(w => chalk.yellow(`• ${w}`)).join('\n')
            : "") +
          (result.suggestions.length > 0 ?
            chalk.blue("\n\nSuggestions:\n") +
            result.suggestions.map(s => chalk.dim(`• ${s}`)).join('\n')
            : ""),
          {
            padding: 1,
            margin: 1,
            borderStyle: "round",
            borderColor: "red"
          }
        )
      );
    }
  }
}