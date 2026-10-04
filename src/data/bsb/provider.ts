import type { ScripturePassage, ScriptureProvider, ScriptureVerse, TranslationMetadata } from '../../bible/types.js';
import type { PassageRef, VerseRef } from '../../domain/references/types.js';
import { compareVerseRefs } from '../../domain/references/reference.js';
import { parseBsbDisplayJsonl, parseBsbOriginalTokens } from './display-parser.js';

export interface TextAssetLoader {
  load(path: string): Promise<string>;
}

export class FetchTextAssetLoader implements TextAssetLoader {
  constructor(private readonly baseUrl = '/data/bsb') {}
  async load(path: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/${path}`);
    if (!response.ok) throw new Error(`Failed to load Scripture asset: ${response.status} ${path}`);
    return response.text();
  }
}

export class BsbScriptureProvider implements ScriptureProvider {
  readonly translation: TranslationMetadata = {
    id: 'BSB',
    name: 'Berean Standard Bible',
    abbreviation: 'BSB',
    language: 'en',
    license: 'Public Domain / CC0 downstream display data',
  };

  #chapterCache = new Map<string, Promise<ScriptureVerse[]>>();
  #chapterTextCache = new Map<string, Promise<string>>();
  #originalCache = new Map<string, Promise<Map<number, import('../../bible/types.js').ScriptureToken[]>>>();

  constructor(private readonly loader: TextAssetLoader) {}

  async #chapterText(book: string, chapter: number): Promise<string> {
    const key = `${book}.${chapter}`;
    let pending = this.#chapterTextCache.get(key);
    if (!pending) {
      pending = this.loader.load(`display/${book}/${book}${chapter}.jsonl`);
      this.#chapterTextCache.set(key, pending);
    }
    return pending;
  }

  async #chapter(book: string, chapter: number): Promise<ScriptureVerse[]> {
    const key = `${book}.${chapter}`;
    let pending = this.#chapterCache.get(key);
    if (!pending) {
      pending = this.#chapterText(book, chapter).then((text) => parseBsbDisplayJsonl(text, book, chapter));
      this.#chapterCache.set(key, pending);
    }
    return pending;
  }

  async #originalChapter(book: string, chapter: number) {
    const key = `${book}.${chapter}`;
    let pending = this.#originalCache.get(key);
    if (!pending) {
      pending = this.#chapterText(book, chapter).then((text) => parseBsbOriginalTokens(text, book, chapter));
      this.#originalCache.set(key, pending);
    }
    return pending;
  }


  async getOriginalVerse(ref: VerseRef) {
    const tokens = (await this.#originalChapter(ref.book, ref.chapter)).get(ref.verse);
    if (!tokens) return [];
    return structuredClone(tokens);
  }

  async getVerse(ref: VerseRef): Promise<ScriptureVerse> {
    const verse = (await this.#chapter(ref.book, ref.chapter)).find((v) => v.ref.verse === ref.verse);
    if (!verse) throw new Error(`Verse not found: ${ref.book}.${ref.chapter}.${ref.verse}`);
    return verse;
  }

  async getPassage(ref: PassageRef): Promise<ScripturePassage> {
    if (ref.start.book !== ref.end.book) throw new Error('Cross-book passages are not supported by BSB provider');
    const verses: ScriptureVerse[] = [];
    for (let chapter = ref.start.chapter; chapter <= ref.end.chapter; chapter += 1) {
      for (const verse of await this.#chapter(ref.start.book, chapter)) {
        if (compareVerseRefs(verse.ref, ref.start) >= 0 && compareVerseRefs(verse.ref, ref.end) <= 0) verses.push(verse);
      }
    }
    return { translationId: this.translation.id, passage: structuredClone(ref), verses };
  }

  async hasPassage(ref: PassageRef): Promise<boolean> {
    try {
      const passage = await this.getPassage(ref);
      return passage.verses.length > 0;
    } catch {
      return false;
    }
  }
}
