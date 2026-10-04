import type { ScriptureVerse } from '../bible/types.js';
import { canonicalVerseId } from '../domain/references/reference.js';
import type { VerseRef } from '../domain/references/types.js';

export interface SerializedScriptureSearchIndex {
  version: 1;
  verses: Array<{ id: string; ref: VerseRef; text: string; normalized: string }>;
  terms: Record<string, string[]>;
}

export interface ScriptureSearchResult {
  ref: VerseRef;
  canonicalId: string;
  text: string;
  score: number;
}

const normalize = (value: string) => value.toLocaleLowerCase('en').normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const verseText = (verse: ScriptureVerse) => verse.tokens.map((token) => token.text).join(' ').replace(/\s+([,.;:!?])/g, '$1');

export class ScriptureSearchIndex {
  #verses = new Map<string, { ref: VerseRef; text: string; normalized: string }>();
  #terms = new Map<string, Set<string>>();

  add(verse: ScriptureVerse): void {
    const id = canonicalVerseId(verse.ref);
    const text = verseText(verse);
    const normalized = normalize(text);
    this.#verses.set(id, { ref: structuredClone(verse.ref), text, normalized });
    for (const term of new Set(normalized.split(' ').filter(Boolean))) {
      let ids = this.#terms.get(term);
      if (!ids) this.#terms.set(term, (ids = new Set()));
      ids.add(id);
    }
  }


  serialize(): SerializedScriptureSearchIndex {
    return {
      version: 1,
      verses: [...this.#verses.entries()].map(([id, verse]) => ({ id, ref: structuredClone(verse.ref), text: verse.text, normalized: verse.normalized })),
      terms: Object.fromEntries([...this.#terms.entries()].map(([term, ids]) => [term, [...ids]])),
    };
  }

  static fromSerialized(value: SerializedScriptureSearchIndex): ScriptureSearchIndex {
    if (value.version !== 1) throw new Error(`Unsupported Scripture search index version: ${value.version}`);
    const index = new ScriptureSearchIndex();
    index.#verses = new Map(value.verses.map((verse) => [verse.id, { ref: structuredClone(verse.ref), text: verse.text, normalized: verse.normalized }]));
    index.#terms = new Map(Object.entries(value.terms).map(([term, ids]) => [term, new Set(ids)]));
    return index;
  }

  search(query: string, limit = 50): ScriptureSearchResult[] {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return [];
    const terms = normalizedQuery.split(' ').filter(Boolean);
    let candidates: Set<string> | undefined;
    for (const term of terms) {
      const ids = this.#terms.get(term) ?? new Set();
      candidates = candidates ? new Set([...candidates].filter((id) => ids.has(id))) : new Set(ids);
    }
    const results: ScriptureSearchResult[] = [];
    for (const id of candidates ?? []) {
      const verse = this.#verses.get(id)!;
      const phraseBoost = verse.normalized.includes(normalizedQuery) ? 10 : 0;
      const coverage = terms.reduce((n, term) => n + (verse.normalized.includes(term) ? 1 : 0), 0);
      results.push({ ref: structuredClone(verse.ref), canonicalId: id, text: verse.text, score: phraseBoost + coverage });
    }
    return results.sort((a, b) => b.score - a.score || a.canonicalId.localeCompare(b.canonicalId)).slice(0, limit);
  }
}
