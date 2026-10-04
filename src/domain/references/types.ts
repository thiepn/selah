export type Testament = 'OT' | 'NT';

export interface BookDefinition {
  id: string;
  osis: string;
  name: string;
  testament: Testament;
  order: number;
  chapters: number;
  aliases: readonly string[];
}

export interface VerseRef {
  book: string;
  chapter: number;
  verse: number;
}

export interface PassageRef {
  start: VerseRef;
  end: VerseRef;
}

export class ReferenceParseError extends Error {
  constructor(message: string, public readonly input: string) {
    super(message);
    this.name = 'ReferenceParseError';
  }
}
