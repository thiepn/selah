import type { VerseRef } from '../../domain/references/types.js';
import type { MorphologyEntry, MorphologyProvider, VerseMorphology } from './types.js';

type RawMorphologyLine = {
  id?: string;
  b?: string;
  c?: number;
  v?: number;
  m?: Array<{ s?: string; m?: string; p?: string; l?: string }>;
};

const key = (ref: VerseRef) => `${ref.book}.${ref.chapter}.${ref.verse}`;

export class BsbMorphologyProvider implements MorphologyProvider {
  #byVerse = new Map<string, VerseMorphology>();

  constructor(jsonl: string) {
    for (const raw of jsonl.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const parsed = JSON.parse(line) as RawMorphologyLine;
      if (!parsed.b || !Number.isInteger(parsed.c) || !Number.isInteger(parsed.v)) continue;
      const ref: VerseRef = { book: parsed.b, chapter: parsed.c!, verse: parsed.v! };
      const entries: MorphologyEntry[] = [];
      for (const item of parsed.m ?? []) {
        if (!item.s) continue;
        const entry: MorphologyEntry = { strongs: item.s };
        if (item.m) entry.morphology = item.m;
        if (item.p) entry.partOfSpeech = item.p;
        if (item.l) entry.lemma = item.l;
        entries.push(entry);
      }
      this.#byVerse.set(key(ref), { ref, entries });
    }
  }

  async forVerse(ref: VerseRef): Promise<VerseMorphology | undefined> {
    const value = this.#byVerse.get(key(ref));
    return value ? structuredClone(value) : undefined;
  }
}
