export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function truncateMessage(
  message: string,
  maxLength: number = 50
): string {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength - 3) + "...";
}

export function formatCommitType(type: string): string {
  const typeMap: { [key: string]: string } = {
    feat: "Feature",
    fix: "Bug Fix",
    docs: "Documentation",
    style: "Style",
    refactor: "Refactor",
    test: "Test",
    chore: "Chore",
    perf: "Performance",
    remove: "Remove",
  };

  return typeMap[type] || capitalize(type);
}
