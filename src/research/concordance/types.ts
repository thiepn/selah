import type { VerseRef } from '../../domain/references/types.js';

export interface ConcordanceProvider {
  versesForStrongs(strongs: string): Promise<VerseRef[]>;
}
