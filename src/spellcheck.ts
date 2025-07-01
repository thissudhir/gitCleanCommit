// Dummy checker for now
export function checkSpelling(message: string): string[] {
  const typos: string[] = [];

  const words = message.split(/\s+/);
  for (const word of words) {
    if (word === "teh" || word === "recieve") {
      typos.push(word);
    }
  }

  return typos;
}
