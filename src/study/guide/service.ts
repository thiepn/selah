import type { ScripturePassage } from '../../bible/types.js';
import { analyzePatterns, type TextPattern } from '../../bible/patterns/analyzer.js';
import type { Annotation } from '../../domain/studies/types.js';
import type { AnnotationService } from '../../annotations/service.js';
import type { CrossReference, CrossReferenceProvider } from '../../research/cross-references/types.js';
import { EXTERNAL_RESOURCES, type ExternalStudyResource } from '../../resources/external.js';

export interface PassageGuideSection {
  verse: number;
  heading: string;
}

export interface PassageGuide {
  scripture: ScripturePassage;
  sections: PassageGuideSection[];
  annotations: Annotation[];
  crossReferences: CrossReference[];
  patterns: TextPattern[];
  importantLexicalKeys: string[];
  resources: Array<{ resource: ExternalStudyResource; url: string }>;
}

export class PassageGuideService {
  constructor(private readonly annotations: AnnotationService, private readonly crossReferences: CrossReferenceProvider) {}

  async build(scripture: ScripturePassage): Promise<PassageGuide> {
    const [annotations, crossReferences] = await Promise.all([
      this.annotations.forPassage(scripture.passage, scripture.translationId),
      this.crossReferences.forPassage(scripture.passage),
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
      annotations,
      crossReferences,
      patterns: analyzePatterns(scripture),
      importantLexicalKeys,
      resources: EXTERNAL_RESOURCES.map((resource)=>({resource,url:resource.buildUrl(scripture.passage)})),
    };
  }
}
