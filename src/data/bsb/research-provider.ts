import type { PassageRef, VerseRef } from '../../domain/references/types.js';
import type { CrossReference, CrossReferenceProvider } from '../../research/cross-references/types.js';
import { BsbPdCrossReferenceProvider } from '../../research/cross-references/bsb-index-provider.js';
import { BsbReverseCrossReferenceProvider } from '../../research/cross-references/bsb-reverse-provider.js';
import type { ConcordanceProvider } from '../../research/concordance/types.js';
import { BsbConcordanceProvider } from '../../research/concordance/bsb-provider.js';
import type { LexiconEntry, LexiconProvider } from '../../research/lexicon/types.js';
import { BsbLexiconProvider } from '../../research/lexicon/bsb-provider.js';
import type { MorphologyProvider, VerseMorphology } from '../../research/morphology/types.js';
import { BsbMorphologyProvider } from '../../research/morphology/bsb-provider.js';
import type { TextAssetLoader } from './provider.js';

interface ChapterResearch {
  crossReferences: BsbPdCrossReferenceProvider;
  morphology: BsbMorphologyProvider;
}

export class BsbResearchProvider implements CrossReferenceProvider, MorphologyProvider, LexiconProvider, ConcordanceProvider {
  #chapterCache = new Map<string, Promise<ChapterResearch>>();
  #lexicon?: Promise<BsbLexiconProvider>;
  #concordance?: Promise<BsbConcordanceProvider>;
  #reverseCrossReferences?: Promise<BsbReverseCrossReferenceProvider | undefined>;

  constructor(private readonly loader: TextAssetLoader) {}

  async #chapter(book: string, chapter: number): Promise<ChapterResearch> {
    const key = `${book}.${chapter}`;
    let pending = this.#chapterCache.get(key);
    if (!pending) {
      pending = Promise.all([
        this.loader.load(`index-cc-by/${book}/${book}${chapter}.jsonl`),
        this.loader.load(`research-verse-map/${book}/${book}${chapter}.json`).catch(() => '[]'),
      ]).then(([jsonl, verseMap]) => {
        const parsed=JSON.parse(verseMap);
        const verseNumbers=Array.isArray(parsed)&&parsed.every((value)=>Number.isInteger(value))?parsed:undefined;
        const context={ book, chapter, ...(verseNumbers?.length?{verseNumbers}: {}) };
        return {
          crossReferences: new BsbPdCrossReferenceProvider(jsonl, context),
          morphology: new BsbMorphologyProvider(jsonl, context),
        };
      });
      this.#chapterCache.set(key, pending);
    }
    return pending;
  }

  async #getLexicon(): Promise<BsbLexiconProvider> {
    this.#lexicon ??= this.loader.load('lexicon/combined_compat.json').then((data) => new BsbLexiconProvider(data));
    return this.#lexicon;
  }

  async #getConcordance(): Promise<BsbConcordanceProvider> {
    this.#concordance ??= this.loader.load('concordance/strongs-to-verses.json').then((data) => new BsbConcordanceProvider(data));
    return this.#concordance;
  }

  async #getReverseCrossReferences(): Promise<BsbReverseCrossReferenceProvider | undefined> {
    this.#reverseCrossReferences ??= this.loader.load('crossrefs/reverse.json')
      .then((data) => new BsbReverseCrossReferenceProvider(data))
      .catch(() => undefined);
    return this.#reverseCrossReferences;
  }

  async forPassage(passage: PassageRef): Promise<CrossReference[]> {
    if (passage.start.book !== passage.end.book) throw new Error('Cross-book research passages are not supported');
    const output: CrossReference[] = [];
    for (let chapter = passage.start.chapter; chapter <= passage.end.chapter; chapter += 1) {
      output.push(...await (await this.#chapter(passage.start.book, chapter)).crossReferences.forPassage(passage));
    }
    return output;
  }

  async backlinksForPassage(passage: PassageRef): Promise<CrossReference[]> {
    const provider = await this.#getReverseCrossReferences();
    return provider ? provider.backlinksForPassage(passage) : [];
  }

  async forVerse(ref: VerseRef): Promise<VerseMorphology | undefined> {
    return (await this.#chapter(ref.book, ref.chapter)).morphology.forVerse(ref);
  }

  async get(strongs: string): Promise<LexiconEntry | undefined> {
    return (await this.#getLexicon()).get(strongs);
  }

  async getMany(strongs: readonly string[]): Promise<LexiconEntry[]> {
    return (await this.#getLexicon()).getMany(strongs);
  }

  async search(query: string, limit?: number): Promise<LexiconEntry[]> {
    return (await this.#getLexicon()).search(query, limit);
  }

  async versesForStrongs(strongs: string): Promise<VerseRef[]> {
    return (await this.#getConcordance()).versesForStrongs(strongs);
  }
}
