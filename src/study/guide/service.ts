import type { ScripturePassage, ScriptureProvider } from '../../bible/types.js';
import { analyzePatterns, analyzeStructuralMarkers, type StructuralMarker, type TextPattern } from '../../bible/patterns/analyzer.js';
import type { PassageRef } from '../../domain/references/types.js';
import type { Annotation } from '../../domain/studies/types.js';
import type { AnnotationService } from '../../annotations/service.js';
import type { CrossReference, CrossReferenceProvider } from '../../research/cross-references/types.js';
import { EXTERNAL_RESOURCES, type ExternalStudyResource } from '../../resources/external.js';

export interface PassageGuideSection {
  verse: number;
  heading: string;
}

export interface PassageGuideContextSection {
  role: 'previous' | 'current' | 'next';
  heading: string;
  passage: PassageRef;
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
  importantLexicalKeys: string[];
  resources: Array<{ resource: ExternalStudyResource; url: string }>;
}

export class PassageGuideService {
  constructor(
    private readonly annotations: AnnotationService,
    private readonly crossReferences: CrossReferenceProvider,
    private readonly scriptureProvider?: ScriptureProvider,
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

  async build(scripture: ScripturePassage): Promise<PassageGuide> {
    const [annotations, crossReferences, backlinks, literaryContext] = await Promise.all([
      this.annotations.forPassage(scripture.passage, scripture.translationId),
      this.crossReferences.forPassage(scripture.passage),
      this.crossReferences.backlinksForPassage?.(scripture.passage) ?? Promise.resolve([]),
      this.#literaryContext(scripture),
    ]);
    const lexicalFrequency = new Map<string, number>();
    for (const token of scripture.verses.flatMap((v)=>v.tokens)) if (token.strongs) lexicalFrequency.set(token.strongs, (lexicalFrequency.get(token.strongs) ?? 0) + 1);
    const importantLexicalKeys = [...lexicalFrequency.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,8).map(([key])=>key);
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
      importantLexicalKeys,
      resources: EXTERNAL_RESOURCES.map((resource)=>({resource,url:resource.buildUrl(scripture.passage)})),
    };
  }
}
