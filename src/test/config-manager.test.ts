import { TestFramework, expect } from "./test-framework.js";
import { ConfigManager } from "../config/config-manager.js";
import { DEFAULT_CONFIG } from "../config/default-config.js";
import { existsSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";

export function runConfigManagerTests(framework: TestFramework): void {
  framework.describe("ConfigManager", () => {
    
    framework.it("should load default config when no file exists", () => {
      ConfigManager.resetCache();
      const config = ConfigManager.loadConfig();
      
      expect.toBeTruthy(config);
      expect.toBeTruthy(config.commitTypes);
      expect.toBeTruthy(config.spellCheck);
      expect.toBeTruthy(config.workflow);
      expect.toEqual(config.spellCheck?.enabled, true);
    });

    framework.it("should detect existing config file", () => {
      ConfigManager.resetCache();
      const configPath = ConfigManager.getCurrentConfigPath();
      
      // Create a temporary config file
      writeFileSync(configPath, JSON.stringify({ spellCheck: { enabled: false } }));
      
      try {
        expect.toBeTruthy(ConfigManager.configExists());
        
        const config = ConfigManager.loadConfig();
        expect.toEqual(config.spellCheck?.enabled, false);
      } finally {
        // Cleanup
        if (existsSync(configPath)) {
          unlinkSync(configPath);
        }
        ConfigManager.resetCache();
      }
    });

    framework.it("should merge user config with defaults", () => {
      ConfigManager.resetCache();
      const configPath = ConfigManager.getCurrentConfigPath();
      
      const userConfig = {
        spellCheck: {
          debounceMs: 500,
        },
        workflow: {
          autoPush: false,
        }
      };
      
      writeFileSync(configPath, JSON.stringify(userConfig));
      
      try {
        const config = ConfigManager.loadConfig();
        
        // Should have merged values
        expect.toEqual(config.spellCheck?.debounceMs, 500);
        expect.toEqual(config.workflow?.autoPush, false);
        
        // Should retain defaults for non-specified values
        expect.toEqual(config.spellCheck?.enabled, true);
        expect.toEqual(config.workflow?.autoAdd, true);
      } finally {
        // Cleanup
        if (existsSync(configPath)) {
          unlinkSync(configPath);
        }
        ConfigManager.resetCache();
      }
    });

    framework.it("should save configuration correctly", () => {
      ConfigManager.resetCache();
      const configPath = ConfigManager.getCurrentConfigPath();
      
      const testConfig = {
        ...DEFAULT_CONFIG,
        spellCheck: {
          ...DEFAULT_CONFIG.spellCheck,
          enabled: false,
        }
      };
      
      try {
        ConfigManager.saveConfig(testConfig);
        expect.toBeTruthy(existsSync(configPath));
        
        // Reset cache and load again to verify
        ConfigManager.resetCache();
        const loadedConfig = ConfigManager.loadConfig();
        expect.toEqual(loadedConfig.spellCheck?.enabled, false);
      } finally {
        // Cleanup
        if (existsSync(configPath)) {
          unlinkSync(configPath);
        }
        ConfigManager.resetCache();
      }
    });

    framework.it("should handle invalid JSON gracefully", () => {
      ConfigManager.resetCache();
      const configPath = ConfigManager.getCurrentConfigPath();
      
      // Write invalid JSON
      writeFileSync(configPath, "{ invalid json }");
      
      try {
        expect.toThrow(() => {
          ConfigManager.loadConfig();
        }, "Failed to load configuration");
      } finally {
        // Cleanup
        if (existsSync(configPath)) {
          unlinkSync(configPath);
        }
        ConfigManager.resetCache();
      }
    });

  });
}