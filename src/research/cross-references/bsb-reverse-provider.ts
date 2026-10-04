import { BOOK_BY_ID, BOOK_BY_OSIS } from '../../domain/references/books.js';
import { compareVerseRefs } from '../../domain/references/reference.js';
import type { PassageRef, VerseRef } from '../../domain/references/types.js';
import type { CrossReference } from './types.js';

export interface SerializedReverseCrossReferenceIndex {
  version: 1;
  incoming: Record<string, string[]>;
}

function parseDataVerseId(value: string): VerseRef {
  const match = /^([^.]+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) throw new Error(`Invalid cross-reference verse id: ${value}`);
  const rawBook = match[1]!;
  const book = BOOK_BY_ID.get(rawBook) ?? BOOK_BY_OSIS.get(rawBook.toLowerCase());
  if (!book) throw new Error(`Unknown cross-reference book id: ${rawBook}`);
  return { book: book.id, chapter: Number(match[2]), verse: Number(match[3]) };
}

const asPassage = (ref: VerseRef): PassageRef => ({ start: ref, end: ref });
const chapterKey = (ref: VerseRef) => `${ref.book}.${ref.chapter}`;

export class BsbReverseCrossReferenceProvider {
  #byChapter = new Map<string, Array<{ target: VerseRef; sources: VerseRef[] }>>();

  constructor(serialized: string | SerializedReverseCrossReferenceIndex) {
    const parsed = typeof serialized === 'string' ? JSON.parse(serialized) as SerializedReverseCrossReferenceIndex : serialized;
    if (parsed.version !== 1 || !parsed.incoming || typeof parsed.incoming !== 'object') {
      throw new Error('Unsupported reverse cross-reference index');
    }
    for (const [targetId, sourceIds] of Object.entries(parsed.incoming)) {
      const target = parseDataVerseId(targetId);
      const key = chapterKey(target);
      const entries = this.#byChapter.get(key) ?? [];
      entries.push({ target, sources: [...new Set(sourceIds)].map(parseDataVerseId) });
      this.#byChapter.set(key, entries);
    }
  }

  async backlinksForPassage(passage: PassageRef): Promise<CrossReference[]> {
    const output: CrossReference[] = [];
    const chapters = passage.start.book === passage.end.book
      ? Array.from({ length: passage.end.chapter - passage.start.chapter + 1 }, (_, index) => passage.start.chapter + index)
      : [];
    const candidateEntries = chapters.length
      ? chapters.flatMap((chapter) => this.#byChapter.get(`${passage.start.book}.${chapter}`) ?? [])
      : [...this.#byChapter.values()].flat();
    for (const entry of candidateEntries) {
      if (compareVerseRefs(entry.target, passage.start) < 0 || compareVerseRefs(entry.target, passage.end) > 0) continue;
      for (const source of entry.sources) {
        output.push({ source: asPassage(source), target: asPassage(entry.target), sourceDataset: 'bsb-crossref-reverse' });
      }
    }
    return output;
  }
}
