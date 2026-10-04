import type { LexiconEntry, LexiconProvider } from './types.js';

type RawLexiconEntry = {
  strongs?: string;
  language?: string;
  lemma?: string;
  transliteration?: string;
  gloss?: string;
  definition?: string;
  source?: string;
  [key: string]: unknown;
};

const normalizeStrongs = (value: string) => value.trim().toUpperCase().replace(/^([GH])0+/, '$1');

function normalizeEntry(raw: RawLexiconEntry, fallbackKey?: string): LexiconEntry | undefined {
  const strongs = normalizeStrongs(raw.strongs ?? fallbackKey ?? '');
  if (!/^[GH]\d+$/.test(strongs)) return undefined;
  const language: 'greek' | 'hebrew' = raw.language === 'hebrew' || strongs.startsWith('H') ? 'hebrew' : 'greek';
  const lemma = typeof raw.lemma === 'string' ? raw.lemma : '';
  const entry: LexiconEntry = { strongs, language, lemma };
  if (typeof raw.transliteration === 'string' && raw.transliteration) entry.transliteration = raw.transliteration;
  if (typeof raw.gloss === 'string' && raw.gloss) entry.gloss = raw.gloss;
  if (typeof raw.definition === 'string' && raw.definition) entry.definition = raw.definition;
  if (typeof raw.source === 'string' && raw.source) entry.source = raw.source;
  return entry;
}

export function parseBsbLexicon(input: string): LexiconEntry[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const output: LexiconEntry[] = [];
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as RawLexiconEntry[] | Record<string, RawLexiconEntry>;
    if (Array.isArray(parsed)) {
      for (const raw of parsed) {
        const entry = normalizeEntry(raw);
        if (entry) output.push(entry);
      }
    } else {
      for (const [key, raw] of Object.entries(parsed)) {
        const entry = normalizeEntry(raw, key);
        if (entry) output.push(entry);
      }
    }
  } else {
    for (const line of trimmed.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const entry = normalizeEntry(JSON.parse(line) as RawLexiconEntry);
      if (entry) output.push(entry);
    }
  }
  return output;
}

export class BsbLexiconProvider implements LexiconProvider {
  #byStrongs = new Map<string, LexiconEntry>();
  #entries: LexiconEntry[];

  constructor(data: string | LexiconEntry[]) {
    this.#entries = typeof data === 'string' ? parseBsbLexicon(data) : data.map((x) => structuredClone(x));
    for (const entry of this.#entries) this.#byStrongs.set(normalizeStrongs(entry.strongs), entry);
  }

  async get(strongs: string): Promise<LexiconEntry | undefined> {
    const value = this.#byStrongs.get(normalizeStrongs(strongs));
    return value ? structuredClone(value) : undefined;
  }

  async getMany(strongs: readonly string[]): Promise<LexiconEntry[]> {
    const output: LexiconEntry[] = [];
    const seen = new Set<string>();
    for (const key of strongs) {
      const normalized = normalizeStrongs(key);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      const value = this.#byStrongs.get(normalized);
      if (value) output.push(structuredClone(value));
    }
    return output;
  }

  async search(query: string, limit = 30): Promise<LexiconEntry[]> {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return [];
    return this.#entries
      .map((entry) => ({ entry, haystack: [entry.strongs, entry.lemma, entry.transliteration, entry.gloss, entry.definition].filter(Boolean).join(' ').toLocaleLowerCase() }))
      .filter(({ haystack }) => haystack.includes(q))
      .sort((a, b) => {
        const aExact = a.entry.strongs.toLocaleLowerCase() === q || a.entry.lemma.toLocaleLowerCase() === q ? 0 : 1;
        const bExact = b.entry.strongs.toLocaleLowerCase() === q || b.entry.lemma.toLocaleLowerCase() === q ? 0 : 1;
        return aExact - bExact || a.entry.strongs.localeCompare(b.entry.strongs);
      })
      .slice(0, limit)
      .map(({ entry }) => structuredClone(entry));
  }
}
