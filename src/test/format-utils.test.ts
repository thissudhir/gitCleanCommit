import { TestFramework, expect } from "./test-framework.js";
import { FormatUtils } from "../utils/format-utils.js";
import { CommitType, CommitAnswers } from "../types/index.js";

export function runFormatUtilsTests(framework: TestFramework): void {
  framework.describe("FormatUtils", () => {
    
    const mockCommitType: CommitType = {
      name: "ADD - Add new code or files",
      value: "ADD",
      color: "green",
      emoji: "➕",
      description: "Added new code or files",
    };

    const mockAnswers: CommitAnswers = {
      type: "ADD",
      scope: "auth",
      message: "implement JWT validation",
      body: "Added secure token validation with refresh capability",
      breaking: false,
      issues: "fixes #123",
    };

    framework.it("should build commit header correctly", () => {
      const header = FormatUtils.buildCommitHeader(mockAnswers);
      expect.toEqual(header, "ADD(auth): implement JWT validation");
    });

    framework.it("should build commit header with breaking change", () => {
      const breakingAnswers = { ...mockAnswers, breaking: true };
      const header = FormatUtils.buildCommitHeader(breakingAnswers);
      expect.toEqual(header, "ADD(auth)!: implement JWT validation");
    });

    framework.it("should build commit header without scope", () => {
      const noScopeAnswers = { ...mockAnswers, scope: "" };
      const header = FormatUtils.buildCommitHeader(noScopeAnswers);
      expect.toEqual(header, "ADD: implement JWT validation");
    });

    framework.it("should build full commit message", () => {
      const fullMessage = FormatUtils.buildFullCommitMessage(mockAnswers);
      const expectedMessage = `ADD(auth): implement JWT validation

Added secure token validation with refresh capability

fixes #123`;
      expect.toEqual(fullMessage, expectedMessage);
    });

    framework.it("should build full commit message with breaking change", () => {
      const breakingAnswers = { ...mockAnswers, breaking: true };
      const fullMessage = FormatUtils.buildFullCommitMessage(breakingAnswers);
      
      expect.toBeTruthy(fullMessage.includes("BREAKING CHANGE:"));
      expect.toBeTruthy(fullMessage.includes("implement JWT validation"));
    });

    framework.it("should truncate text correctly", () => {
      const longText = "This is a very long text that should be truncated";
      const truncated = FormatUtils.truncateText(longText, 20);
      
      expect.toEqual(truncated.length, 20);
      expect.toBeTruthy(truncated.endsWith("..."));
    });

    framework.it("should not truncate short text", () => {
      const shortText = "Short text";
      const result = FormatUtils.truncateText(shortText, 20);
      
      expect.toEqual(result, shortText);
    });

    framework.it("should capitalize text correctly", () => {
      expect.toEqual(FormatUtils.capitalize("hello"), "Hello");
      expect.toEqual(FormatUtils.capitalize("HELLO"), "HELLO");
      expect.toEqual(FormatUtils.capitalize(""), "");
    });

    framework.it("should format commit type choice", () => {
      const choice = FormatUtils.formatCommitTypeChoice(mockCommitType);
      
      expect.toEqual(choice.name, mockCommitType.name);
      expect.toEqual(choice.value, mockCommitType.value);
      expect.toEqual(choice.short, `${mockCommitType.emoji} ${mockCommitType.value}`);
    });

    framework.it("should create spell check display text", () => {
      const text = "This is a test message";
      const errors = [
        {
          word: "test",
          position: { start: 10, end: 14 }
        }
      ];
      
      const displayText = FormatUtils.createSpellCheckDisplayText(text, errors);
      expect.toBeTruthy(displayText.includes(text));
    });

  });
}