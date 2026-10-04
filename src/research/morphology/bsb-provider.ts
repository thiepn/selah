import type { VerseRef } from '../../domain/references/types.js';
import type { ChapterIndexContext } from '../cross-references/bsb-index-provider.js';
import type { MorphologyEntry, MorphologyProvider, VerseMorphology } from './types.js';

type RawMorphologyLine = {
  id?: string;
  b?: string;
  c?: number;
  v?: number;
  m?: Array<{ s?: string; m?: string; p?: string; l?: string }>;
};

const key = (ref: VerseRef) => `${ref.book}.${ref.chapter}.${ref.verse}`;

function inferredRef(parsed: RawMorphologyLine, index: number, context?: ChapterIndexContext): VerseRef | undefined {
  if (parsed.b && Number.isInteger(parsed.c) && Number.isInteger(parsed.v)) {
    return { book: parsed.b, chapter: parsed.c!, verse: parsed.v! };
  }
  if (parsed.id) {
    const match=/^([^.]+)\.(\d+)\.(\d+)$/.exec(parsed.id);
    if (match) return { book:match[1]!, chapter:Number(match[2]), verse:Number(match[3]) };
  }
  return context ? { book:context.book, chapter:context.chapter, verse:index+1 } : undefined;
}

export class BsbMorphologyProvider implements MorphologyProvider {
  #byVerse = new Map<string, VerseMorphology>();

  constructor(jsonl: string, context?: ChapterIndexContext) {
    const lines=jsonl.split(/\r?\n/).map((x)=>x.trim()).filter(Boolean);
    lines.forEach((line,index)=>{
      const parsed = JSON.parse(line) as RawMorphologyLine;
      const ref=inferredRef(parsed,index,context);
      if(!ref)return;
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
    });
  }

  async forVerse(ref: VerseRef): Promise<VerseMorphology | undefined> {
    const value = this.#byVerse.get(key(ref));
    return value ? structuredClone(value) : undefined;
  }
}
