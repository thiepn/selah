import type { VerseRef } from '../../domain/references/types.js';

export interface MorphologyEntry {
  strongs: string;
  morphology?: string;
  partOfSpeech?: string;
  lemma?: string;
}

export interface VerseMorphology {
  ref: VerseRef;
  entries: MorphologyEntry[];
}

export interface MorphologyProvider {
  forVerse(ref: VerseRef): Promise<VerseMorphology | undefined>;
}
