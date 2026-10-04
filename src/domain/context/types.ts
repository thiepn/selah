import type { PassageRef, VerseRef } from '../references/types.js';

export interface TextSelection {
  range?: PassageRef;
  text?: string;
  tokenIds?: string[];
}

export interface PassageContext {
  primaryPassage: PassageRef;
  activeVerse?: VerseRef;
  selection?: TextSelection;
  translationId: string;
  studyId?: string;
}

export type PassageContextPatch = Partial<PassageContext>;
