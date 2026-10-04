import { BOOK_BY_ID, BOOKS, findBook } from './books.js';
import { ReferenceParseError, type PassageRef, type VerseRef } from './types.js';

export const verseRef = (book: string, chapter: number, verse: number): VerseRef => ({ book, chapter, verse });

export function compareVerseRefs(a: VerseRef, b: VerseRef): number {
  const ao = BOOK_BY_ID.get(a.book)?.order;
  const bo = BOOK_BY_ID.get(b.book)?.order;
  if (ao === undefined || bo === undefined) throw new Error('Unknown book id');
  return ao - bo || a.chapter - b.chapter || a.verse - b.verse;
}

export function canonicalVerseId(ref: VerseRef): string {
  const book = BOOK_BY_ID.get(ref.book);
  if (!book) throw new Error(`Unknown book: ${ref.book}`);
  return `${book.osis}.${ref.chapter}.${ref.verse}`;
}

export function canonicalPassageId(ref: PassageRef): string {
  const start = canonicalVerseId(ref.start);
  const end = canonicalVerseId(ref.end);
  return start === end ? start : `${start}-${end}`;
}

export function formatPassage(ref: PassageRef): string {
  const startBook = BOOK_BY_ID.get(ref.start.book);
  const endBook = BOOK_BY_ID.get(ref.end.book);
  if (!startBook || !endBook) throw new Error('Unknown book id');
  if (ref.start.book === ref.end.book && ref.start.chapter === ref.end.chapter) {
    if (ref.start.verse === ref.end.verse) return `${startBook.name} ${ref.start.chapter}:${ref.start.verse}`;
    return `${startBook.name} ${ref.start.chapter}:${ref.start.verse}–${ref.end.verse}`;
  }
  if (ref.start.book === ref.end.book) {
    return `${startBook.name} ${ref.start.chapter}:${ref.start.verse}–${ref.end.chapter}:${ref.end.verse}`;
  }
  return `${startBook.name} ${ref.start.chapter}:${ref.start.verse}–${endBook.name} ${ref.end.chapter}:${ref.end.verse}`;
}

export function formatChapter(bookId: string, chapter: number): string {
  const book = BOOK_BY_ID.get(bookId);
  if (!book) throw new Error(`Unknown book: ${bookId}`);
  return `${book.name} ${chapter}`;
}

function assertChapter(bookId: string, chapter: number, input: string): void {
  const book = BOOK_BY_ID.get(bookId);
  if (!book) throw new ReferenceParseError(`Unknown book ${bookId}`, input);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    throw new ReferenceParseError(`Invalid chapter ${chapter} for ${book.name}`, input);
  }
}

function assertVerseNumber(verse: number, input: string): void {
  // Exact max-verse validation belongs to versification data. This guards malformed refs now.
  if (!Number.isInteger(verse) || verse < 1 || verse > 200) {
    throw new ReferenceParseError(`Invalid verse ${verse}`, input);
  }
}

export interface ParsedReference {
  kind: 'chapter' | 'passage';
  book: string;
  chapter: number;
  passage?: PassageRef;
}

export function parseReference(raw: string): ParsedReference {
  const input = raw.trim().replace(/[–—]/g, '-').replace(/\s+/g, ' ');
  if (!input) throw new ReferenceParseError('Reference is empty', raw);

  // Longest alias wins, which prevents "1 John" being consumed as "John".
  const candidates = [...BOOKS]
    .flatMap((book) => [book.name, book.osis, book.id, ...book.aliases].map((alias) => ({ alias, book })))
    .sort((a, b) => b.alias.length - a.alias.length);

  const lowered = input.toLowerCase().replace(/[._]/g, ' ');
  let matchedBook = undefined as ReturnType<typeof findBook>;
  let matchedAlias = '';

  for (const { alias, book } of candidates) {
    const normalized = alias.toLowerCase().replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
    if (lowered === normalized || lowered.startsWith(`${normalized} `)) {
      matchedBook = book;
      matchedAlias = normalized;
      break;
    }
  }
  if (!matchedBook) throw new ReferenceParseError(`Unknown Bible book in “${raw}”`, raw);

  const rest = lowered.slice(matchedAlias.length).trim();
  const chapterOnly = /^(\d+)$/.exec(rest);
  if (chapterOnly) {
    const chapter = Number(chapterOnly[1]);
    assertChapter(matchedBook.id, chapter, raw);
    return { kind: 'chapter', book: matchedBook.id, chapter };
  }

  const verseRange = /^(\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/.exec(rest);
  if (!verseRange) throw new ReferenceParseError(`Could not parse reference “${raw}”`, raw);

  const startChapter = Number(verseRange[1]);
  const startVerse = Number(verseRange[2]);
  const endChapter = verseRange[3] ? Number(verseRange[3]) : startChapter;
  const endVerse = verseRange[4] ? Number(verseRange[4]) : startVerse;
  assertChapter(matchedBook.id, startChapter, raw);
  assertChapter(matchedBook.id, endChapter, raw);
  assertVerseNumber(startVerse, raw);
  assertVerseNumber(endVerse, raw);

  const start = verseRef(matchedBook.id, startChapter, startVerse);
  const end = verseRef(matchedBook.id, endChapter, endVerse);
  if (compareVerseRefs(end, start) < 0) throw new ReferenceParseError('Reference range ends before it starts', raw);

  return {
    kind: 'passage',
    book: matchedBook.id,
    chapter: startChapter,
    passage: { start, end },
  };
}
