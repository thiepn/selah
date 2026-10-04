import type { ScriptureToken } from '../../bible/types.js';
import type { VerseRef } from '../../domain/references/types.js';
import type { ConcordanceProvider } from '../concordance/types.js';
import type { LexiconEntry, LexiconProvider } from '../lexicon/types.js';
import type { MorphologyEntry, MorphologyProvider } from '../morphology/types.js';

export interface OriginalTokenAnalysis {
  ref: VerseRef;
  token: ScriptureToken;
  lexicon?: LexiconEntry;
  morphology?: MorphologyEntry;
  occurrenceCount?: number;
  occurrences?: VerseRef[];
}

export interface OriginalVerseSource {
  getOriginalVerse(ref: VerseRef): Promise<ScriptureToken[]>;
}

export class OriginalLanguageService {
  constructor(
    private readonly source: OriginalVerseSource,
    private readonly lexicon?: LexiconProvider,
    private readonly morphology?: MorphologyProvider,
    private readonly concordance?: ConcordanceProvider,
  ) {}

  async analyzeVerse(ref: VerseRef): Promise<OriginalTokenAnalysis[]> {
    const tokens = await this.source.getOriginalVerse(ref);
    const morphology = await this.morphology?.forVerse(ref);
    const morphologyQueues = new Map<string, MorphologyEntry[]>();
    for (const entry of morphology?.entries ?? []) {
      const list = morphologyQueues.get(entry.strongs) ?? [];
      list.push(entry);
      morphologyQueues.set(entry.strongs, list);
    }

    const uniqueStrongs = [...new Set(tokens.map((t) => t.strongs).filter((x): x is string => Boolean(x)))];
    const lexiconEntries = new Map((await this.lexicon?.getMany(uniqueStrongs) ?? []).map((x) => [x.strongs, x]));
    const occurrencesByStrongs = new Map<string, VerseRef[]>();
    if (this.concordance) {
      await Promise.all(uniqueStrongs.map(async (strongs) => {
        occurrencesByStrongs.set(strongs, await this.concordance!.versesForStrongs(strongs));
      }));
    }

    return tokens.map((token) => {
      const analysis: OriginalTokenAnalysis = { ref: structuredClone(ref), token: structuredClone(token) };
      if (!token.strongs) return analysis;
      const lex = lexiconEntries.get(token.strongs);
      if (lex) analysis.lexicon = structuredClone(lex);
      const queue = morphologyQueues.get(token.strongs);
      const morph = queue?.shift();
      if (morph) analysis.morphology = structuredClone(morph);
      const occurrences = occurrencesByStrongs.get(token.strongs);
      if (occurrences) {
        analysis.occurrences = structuredClone(occurrences);
        analysis.occurrenceCount = occurrences.length;
      }
      return analysis;
    });
  }
}
