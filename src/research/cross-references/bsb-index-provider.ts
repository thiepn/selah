import { BOOK_BY_ID, BOOK_BY_OSIS } from '../../domain/references/books.js';
import type { PassageRef, VerseRef } from '../../domain/references/types.js';
import { compareVerseRefs } from '../../domain/references/reference.js';
import type { CrossReference, CrossReferenceProvider } from './types.js';

interface PdIndexLine { id?: string; b?: string; c?: number; v?: number; x?: string[]; }

export interface ChapterIndexContext { book: string; chapter: number; verseNumbers?: number[]; }

function parseCanonicalVerse(value: string): VerseRef {
  const match = /^([^.]+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) throw new Error(`Invalid canonical verse: ${value}`);
  const rawBook = match[1]!;
  const book = BOOK_BY_ID.get(rawBook) ?? BOOK_BY_OSIS.get(rawBook.toLowerCase());
  return { book: book?.id ?? rawBook, chapter: Number(match[2]), verse: Number(match[3]) };
}

function sourceRef(line: PdIndexLine, index: number, context?: ChapterIndexContext): VerseRef | undefined {
  if (line.b && Number.isInteger(line.c) && Number.isInteger(line.v)) {
    return { book: line.b, chapter: line.c!, verse: line.v! };
  }
  if (line.id) return parseCanonicalVerse(line.id);
  if (context) {
    const verse = context.verseNumbers?.[index] ?? index + 1;
    return { book: context.book, chapter: context.chapter, verse };
  }
  return undefined;
}

const asPassage = (ref: VerseRef): PassageRef => ({ start: ref, end: ref });

export class BsbPdCrossReferenceProvider implements CrossReferenceProvider {
  #lines: Array<{ ref: VerseRef; targets: string[] }> = [];

  constructor(jsonl: string, context?: ChapterIndexContext) {
    const rawLines = jsonl.split(/\r?\n/).map((x)=>x.trim()).filter(Boolean);
    rawLines.forEach((raw, index) => {
      const line = JSON.parse(raw) as PdIndexLine;
      const ref = sourceRef(line, index, context);
      if (!ref) return;
      this.#lines.push({ ref, targets: line.x ?? [] });
    });
  }

  async forPassage(passage: PassageRef): Promise<CrossReference[]> {
    const output: CrossReference[] = [];
    for (const line of this.#lines) {
      if (compareVerseRefs(line.ref, passage.start) < 0 || compareVerseRefs(line.ref, passage.end) > 0) continue;
      for (const target of line.targets) {
        output.push({ source: asPassage(line.ref), target: asPassage(parseCanonicalVerse(target)), sourceDataset: 'bsb-index-pd' });
      }
    }
    return output;
  }
}
