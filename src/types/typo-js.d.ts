declare module "typo-js" {
  export default class Typo {
    constructor(
      dictionary?: string,
      affData?: string | null,
      wordsData?: string | null,
      options?: any
    );

    check(word: string): boolean;
    suggest(word: string, limit?: number): string[];

    static loadedDictionary: any;
    static prototype: any;
  }
}
