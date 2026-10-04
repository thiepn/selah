import { BOOK_BY_OSIS } from '../../domain/references/books.js';
import type { PassageRef, VerseRef } from '../../domain/references/types.js';
import { compareVerseRefs } from '../../domain/references/reference.js';
import type { CrossReference, CrossReferenceProvider } from './types.js';

interface PdIndexLine { id: string; b: string; c: number; v: number; x?: string[]; }

function parseCanonicalVerse(value: string): VerseRef {
  const match = /^([^.]+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) throw new Error(`Invalid canonical verse: ${value}`);
  const book = BOOK_BY_OSIS.get(match[1]!.toLowerCase());
  if (!book) return { book: match[1]!, chapter: Number(match[2]), verse: Number(match[3]) };
  return { book: book.id, chapter: Number(match[2]), verse: Number(match[3]) };
}

const asPassage = (ref: VerseRef): PassageRef => ({ start: ref, end: ref });

export class BsbPdCrossReferenceProvider implements CrossReferenceProvider {
  #lines: PdIndexLine[];

  constructor(jsonl: string) {
    this.#lines = jsonl.split(/\r?\n/).map((x)=>x.trim()).filter(Boolean).map((x)=>JSON.parse(x) as PdIndexLine);
  }

  async forPassage(passage: PassageRef): Promise<CrossReference[]> {
    const output: CrossReference[] = [];
    for (const line of this.#lines) {
      const sourceRef: VerseRef = { book: line.b, chapter: line.c, verse: line.v };
      if (compareVerseRefs(sourceRef, passage.start) < 0 || compareVerseRefs(sourceRef, passage.end) > 0) continue;
      for (const target of line.x ?? []) {
        output.push({ source: asPassage(sourceRef), target: asPassage(parseCanonicalVerse(target)), sourceDataset: 'bsb-index-pd' });
      }
    }
    return output;
  }
}
