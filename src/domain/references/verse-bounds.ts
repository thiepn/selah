import { BOOK_BY_ID } from './books.js';
import type { PassageRef, VerseRef } from './types.js';

export type VerseBoundsData = Record<string, Record<string, number>>;

export class VerseBoundsIndex {
  constructor(private readonly data: VerseBoundsData) {}

  maxVerse(book: string, chapter: number): number | undefined {
    return this.data[book]?.[String(chapter)];
  }

  validateVerse(ref: VerseRef): void {
    const book=BOOK_BY_ID.get(ref.book);
    if(!book) throw new Error(`Unknown Bible book: ${ref.book}`);
    if(ref.chapter<1||ref.chapter>book.chapters) throw new Error(`${book.name} has no chapter ${ref.chapter}`);
    const max=this.maxVerse(ref.book,ref.chapter);
    if(max!==undefined&&(ref.verse<1||ref.verse>max)) throw new Error(`${book.name} ${ref.chapter} has no verse ${ref.verse}`);
  }

  validatePassage(passage: PassageRef): void {
    this.validateVerse(passage.start);
    this.validateVerse(passage.end);
  }
}
