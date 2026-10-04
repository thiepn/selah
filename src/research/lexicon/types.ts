export interface LexiconEntry {
  strongs: string;
  language: 'greek' | 'hebrew';
  lemma: string;
  transliteration?: string;
  gloss?: string;
  definition?: string;
  source?: string;
}

export interface LexiconProvider {
  get(strongs: string): Promise<LexiconEntry | undefined>;
  getMany(strongs: readonly string[]): Promise<LexiconEntry[]>;
  search(query: string, limit?: number): Promise<LexiconEntry[]>;
}
