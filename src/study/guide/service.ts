import type { ScripturePassage, ScriptureProvider } from '../../bible/types.js';
import { analyzePatterns, analyzeStructuralMarkers, type StructuralMarker, type TextPattern } from '../../bible/patterns/analyzer.js';
import type { PassageRef } from '../../domain/references/types.js';
import type { Annotation, LiteraryMode } from '../../domain/studies/types.js';
import type { AnnotationService } from '../../annotations/service.js';
import type { CrossReference, CrossReferenceProvider } from '../../research/cross-references/types.js';
import type { LexiconEntry, LexiconProvider } from '../../research/lexicon/types.js';
import { EXTERNAL_RESOURCES, type ExternalStudyResource } from '../../resources/external.js';
import { buildObservationPrompts, type ObservationPrompt } from '../observation/prompts.js';
import { defaultLiteraryMode } from '../observation/literary-mode.js';

export interface PassageGuideSection {
  verse: number;
  heading: string;
}

export interface PassageGuideContextSection {
  role: 'previous' | 'current' | 'next';
  heading: string;
  passage: PassageRef;
}

export interface PassageGuideLexicalItem {
  strongs: string;
  count: number;
  entry?: LexiconEntry;
}

export interface PassageGuide {
  scripture: ScripturePassage;
  sections: PassageGuideSection[];
  literaryContext: PassageGuideContextSection[];
  annotations: Annotation[];
  crossReferences: CrossReference[];
  backlinks: CrossReference[];
  patterns: TextPattern[];
  structuralMarkers: StructuralMarker[];
  observationPrompts: ObservationPrompt[];
  literaryMode: LiteraryMode;
  importantLexicalKeys: string[];
  importantLexicalItems: PassageGuideLexicalItem[];
  resources: Array<{ resource: ExternalStudyResource; url: string }>;
}

export class PassageGuideService {
  constructor(
    private readonly annotations: AnnotationService,
    private readonly crossReferences: CrossReferenceProvider,
    private readonly scriptureProvider?: ScriptureProvider,
    private readonly lexicon?: LexiconProvider,
  ) {}

  async #literaryContext(scripture: ScripturePassage): Promise<PassageGuideContextSection[]> {
    if (!this.scriptureProvider?.getChapter) return [];
    if (scripture.passage.start.book !== scripture.passage.end.book || scripture.passage.start.chapter !== scripture.passage.end.chapter) return [];
    const { book, chapter } = scripture.passage.start;
    const verses = await this.scriptureProvider.getChapter(book, chapter);
    if (!verses.length) return [];
    const headingStarts = verses.filter((verse) => Boolean(verse.heading));
    if (!headingStarts.length) return [];
    const lastVerse = verses.at(-1)!.ref.verse;
    const sections = headingStarts.map((verse, index) => {
      const next = headingStarts[index + 1];
      return {
        heading: verse.heading!,
        passage: {
          start: structuredClone(verse.ref),
          end: { book, chapter, verse: next ? next.ref.verse - 1 : lastVerse },
        },
      };
    });
    const overlaps = sections.map((section, index) => ({ section, index })).filter(({ section }) =>
      section.passage.end.verse >= scripture.passage.start.verse && section.passage.start.verse <= scripture.passage.end.verse,
    );
    if (!overlaps.length) return [];
    const first = overlaps[0]!.index;
    const last = overlaps.at(-1)!.index;
    const output: PassageGuideContextSection[] = [];
    if (first > 0) output.push({ role:'previous', ...sections[first - 1]! });
    for (const { section } of overlaps) output.push({ role:'current', ...section });
    if (last < sections.length - 1) output.push({ role:'next', ...sections[last + 1]! });
    return output;
  }

  async build(scripture: ScripturePassage, literaryMode: LiteraryMode = defaultLiteraryMode(scripture.passage)): Promise<PassageGuide> {
    const [annotations, crossReferences, backlinks, literaryContext] = await Promise.all([
      this.annotations.forPassage(scripture.passage, scripture.translationId),
      this.crossReferences.forPassage(scripture.passage),
      this.crossReferences.backlinksForPassage?.(scripture.passage) ?? Promise.resolve([]),
      this.#literaryContext(scripture),
    ]);
    const lexicalFrequency = new Map<string, number>();
    if (this.scriptureProvider?.getOriginalVerse) {
      for (const verse of scripture.verses) {
        for (const token of await this.scriptureProvider.getOriginalVerse(verse.ref)) {
          if (token.strongs) lexicalFrequency.set(token.strongs, (lexicalFrequency.get(token.strongs) ?? 0) + 1);
        }
      }
    }
    // Development fixtures and providers without original-language data may
    // still expose conservative Strong's alignment on English tokens.
    if (!lexicalFrequency.size) {
      for (const token of scripture.verses.flatMap((v)=>v.tokens)) {
        if (token.strongs) lexicalFrequency.set(token.strongs, (lexicalFrequency.get(token.strongs) ?? 0) + 1);
      }
    }
    const importantLexicalPairs = [...lexicalFrequency.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,8);
    const importantLexicalKeys = importantLexicalPairs.map(([key])=>key);
    const lexicalEntries = new Map((await this.lexicon?.getMany(importantLexicalKeys) ?? []).map((entry)=>[entry.strongs,entry]));
    const importantLexicalItems = importantLexicalPairs.map(([strongs,count])=>{ const entry=lexicalEntries.get(strongs); return entry ? { strongs, count, entry } : { strongs, count }; });
    const sections = scripture.verses
      .filter((verse) => Boolean(verse.heading))
      .map((verse) => ({ verse: verse.ref.verse, heading: verse.heading! }));
    return {
      scripture,
      sections,
      literaryContext,
      annotations,
      crossReferences,
      backlinks,
      patterns: analyzePatterns(scripture),
      structuralMarkers: analyzeStructuralMarkers(scripture),
      observationPrompts: buildObservationPrompts(scripture,literaryMode),
      literaryMode,
      importantLexicalKeys,
      importantLexicalItems,
      resources: EXTERNAL_RESOURCES.map((resource)=>({resource,url:resource.buildUrl(scripture.passage)})),
    };
  }
}
