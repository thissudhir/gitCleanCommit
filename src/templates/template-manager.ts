import { CommitTemplate, CommitAnswers } from "../types/index.js";
import { ConfigManager } from "../config/config-manager.js";
import { FormatUtils } from "../utils/format-utils.js";

export class TemplateManager {
  
  /**
   * Get all available templates from configuration
   */
  public static getTemplates(): CommitTemplate[] {
    const config = ConfigManager.loadConfig();
    return config.templates || [];
  }

  /**
   * Get template by name
   */
  public static getTemplate(name: string): CommitTemplate | undefined {
    const templates = this.getTemplates();
    return templates.find(template => template.name === name);
  }

  /**
   * Apply template to create commit answers
   */
  public static applyTemplate(templateName: string, customScope?: string): CommitAnswers {
    const template = this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template "${templateName}" not found`);
    }

    return {
      type: template.type,
      scope: customScope || template.scope || "",
      message: template.message,
      body: template.body || "",
      breaking: template.breaking || false,
      issues: "",
    };
  }

  /**
   * Create template choices for inquirer
   */
  public static getTemplateChoices(): Array<{ name: string; value: string }> {
    const templates = this.getTemplates();
    return templates.map(template => ({
      name: `${template.name} - ${template.message}`,
      value: template.name,
    }));
  }

  /**
   * Get default templates that can be added to configuration
   */
  public static getDefaultTemplates(): CommitTemplate[] {
    return [
      {
        name: "feature",
        type: "ADD",
        message: "new feature implementation",
        body: "Implemented new feature with proper testing and documentation",
      },
      {
        name: "bugfix",
        type: "FIX",
        message: "resolve critical bug",
        body: "Fixed bug that was causing issues in production environment",
      },
      {
        name: "hotfix",
        type: "FIX",
        message: "critical production fix",
        body: "Emergency fix for production issue",
        breaking: false,
      },
      {
        name: "docs-update",
        type: "DOCS",
        message: "update documentation",
        body: "Updated documentation to reflect recent changes",
      },
      {
        name: "test-addition",
        type: "TEST",
        message: "add comprehensive tests",
        body: "Added unit and integration tests to improve coverage",
      },
      {
        name: "refactor",
        type: "UPDATE",
        message: "refactor codebase",
        body: "Refactored code to improve maintainability and performance",
      },
      {
        name: "breaking-change",
        type: "UPDATE",
        message: "introduce breaking changes",
        body: "Updated API with breaking changes for better functionality",
        breaking: true,
      },
      {
        name: "dependency-update",
        type: "UPDATE",
        message: "update dependencies",
        body: "Updated project dependencies to latest versions",
      },
      {
        name: "cleanup",
        type: "REMOVE",
        message: "remove deprecated code",
        body: "Removed deprecated functions and cleaned up codebase",
      },
      {
        name: "initial-commit",
        type: "ADD",
        message: "initial project setup",
        body: "Initial commit with project structure and basic configuration",
      },
    ];
  }

  /**
   * Add templates to configuration
   */
  public static addTemplatesToConfig(templates: CommitTemplate[]): void {
    const config = ConfigManager.loadConfig();
    const existingTemplates = config.templates || [];
    
    // Merge templates, avoiding duplicates by name
    const templateMap = new Map<string, CommitTemplate>();
    
    // Add existing templates
    existingTemplates.forEach(template => {
      templateMap.set(template.name, template);
    });
    
    // Add new templates (will overwrite existing ones with same name)
    templates.forEach(template => {
      templateMap.set(template.name, template);
    });
    
    const mergedTemplates = Array.from(templateMap.values());
    
    const updatedConfig = {
      ...config,
      templates: mergedTemplates,
    };
    
    ConfigManager.saveConfig(updatedConfig);
  }

  /**
   * Remove template from configuration
   */
  public static removeTemplate(templateName: string): boolean {
    const config = ConfigManager.loadConfig();
    const templates = config.templates || [];
    
    const filteredTemplates = templates.filter(template => template.name !== templateName);
    
    if (filteredTemplates.length === templates.length) {
      return false; // Template not found
    }
    
    const updatedConfig = {
      ...config,
      templates: filteredTemplates,
    };
    
    ConfigManager.saveConfig(updatedConfig);
    return true;
  }

  /**
   * Validate template structure
   */
  public static validateTemplate(template: CommitTemplate): string[] {
    const errors: string[] = [];
    
    if (!template.name || template.name.trim().length === 0) {
      errors.push("Template name is required");
    }
    
    if (!template.type || template.type.trim().length === 0) {
      errors.push("Template type is required");
    }
    
    if (!template.message || template.message.trim().length === 0) {
      errors.push("Template message is required");
    }
    
    if (template.message && template.message.length > 72) {
      errors.push("Template message should be under 72 characters");
    }
    
    return errors;
  }
}