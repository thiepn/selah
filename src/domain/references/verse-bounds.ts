import { BOOK_BY_ID } from './books.js';
import type { PassageRef, VerseRef } from './types.js';

export type VerseBoundsData = Record<string, Record<string, number>>;
export type VersePresenceData = Record<string, Record<string, number[]>>;

export class VerseBoundsIndex {
  readonly #presence: VersePresenceData | undefined;

  constructor(private readonly data: VerseBoundsData, presence?: VersePresenceData) {
    this.#presence=presence;
  }

  maxVerse(book: string, chapter: number): number | undefined {
    return this.data[book]?.[String(chapter)];
  }

  hasExactVerseData(book: string, chapter: number): boolean {
    return Array.isArray(this.#presence?.[book]?.[String(chapter)]);
  }

  hasVerse(ref: VerseRef): boolean | undefined {
    const verses=this.#presence?.[ref.book]?.[String(ref.chapter)];
    if(!verses)return undefined;
    return verses.includes(ref.verse);
  }

  validateVerse(ref: VerseRef): void {
    const book=BOOK_BY_ID.get(ref.book);
    if(!book) throw new Error(`Unknown Bible book: ${ref.book}`);
    if(ref.chapter<1||ref.chapter>book.chapters) throw new Error(`${book.name} has no chapter ${ref.chapter}`);
    const max=this.maxVerse(ref.book,ref.chapter);
    if(max!==undefined&&(ref.verse<1||ref.verse>max)) throw new Error(`${book.name} ${ref.chapter} has no verse ${ref.verse}`);
    const present=this.hasVerse(ref);
    if(present===false) throw new Error(`${book.name} ${ref.chapter}:${ref.verse} is not present in this translation's versification`);
  }

  validatePassage(passage: PassageRef): void {
    this.validateVerse(passage.start);
    this.validateVerse(passage.end);
  }
}
