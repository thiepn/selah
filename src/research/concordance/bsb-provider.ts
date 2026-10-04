import { BOOK_BY_ID, BOOK_BY_OSIS } from '../../domain/references/books.js';
import type { VerseRef } from '../../domain/references/types.js';
import type { ConcordanceProvider } from './types.js';

function parseVerse(value: string): VerseRef | undefined {
  const match = /^([^.]+)\.(\d+)\.(\d+)$/.exec(value.trim());
  if (!match) return undefined;
  const token = match[1]!;
  const byId = BOOK_BY_ID.get(token);
  const byOsis = BOOK_BY_OSIS.get(token.toLowerCase());
  const book = byId?.id ?? byOsis?.id ?? token;
  return { book, chapter: Number(match[2]), verse: Number(match[3]) };
}

export class BsbConcordanceProvider implements ConcordanceProvider {
  #index = new Map<string, VerseRef[]>();

  constructor(input: string) {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed) as Record<string, string[]>;
      for (const [strongs, values] of Object.entries(parsed)) this.#set(strongs, values);
    } else {
      for (const line of trimmed.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const parsed = JSON.parse(line) as { strongs?: string; verses?: string[] };
        if (parsed.strongs) this.#set(parsed.strongs, parsed.verses ?? []);
      }
    }
  }

  #set(strongs: string, values: string[]): void {
    this.#index.set(strongs.toUpperCase(), values.map(parseVerse).filter((x): x is VerseRef => Boolean(x)));
  }

  async versesForStrongs(strongs: string): Promise<VerseRef[]> {
    return structuredClone(this.#index.get(strongs.toUpperCase()) ?? []);
  }
}
