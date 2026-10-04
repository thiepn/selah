import type { PassageRef, VerseRef } from '../domain/references/types.js';

export type ScriptureLanguage = 'en' | 'grc' | 'hbo';

export interface ScriptureToken {
  id: string;
  text: string;
  strongs?: string;
  lemma?: string;
  morphology?: string;
  language: ScriptureLanguage;
}

export interface ScriptureVerse {
  ref: VerseRef;
  tokens: ScriptureToken[];
  paragraphStart?: boolean;
  poetry?: boolean;
  heading?: string;
}

export interface ScripturePassage {
  translationId: string;
  passage: PassageRef;
  verses: ScriptureVerse[];
}

export interface TranslationMetadata {
  id: string;
  name: string;
  abbreviation: string;
  language: string;
  license: string;
  attribution?: string;
}

export interface ScriptureProvider {
  readonly translation: TranslationMetadata;
  getVerse(ref: VerseRef): Promise<ScriptureVerse>;
  getPassage(ref: PassageRef): Promise<ScripturePassage>;
  getChapter?(book: string, chapter: number): Promise<ScriptureVerse[]>;
  getOriginalVerse?(ref: VerseRef): Promise<ScriptureToken[]>;
  hasPassage(ref: PassageRef): Promise<boolean>;
}
