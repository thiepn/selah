import type { ScripturePassage } from '../../bible/types.js';
import type { PassageRef } from '../../domain/references/types.js';
import type { AnnotationService } from '../../annotations/service.js';
import type { CrossReferenceProvider } from '../../research/cross-references/types.js';

export interface PassageLens {
  passage: PassageRef;
  crossReferenceCount: number;
  backlinkCount: number;
  annotationCount: number;
  lexicalKeys: string[];
}

export class LensService {
  constructor(private readonly annotations: AnnotationService, private readonly crossReferences: CrossReferenceProvider) {}

  async forPassage(scripture: ScripturePassage): Promise<PassageLens> {
    const [references, backlinks, annotations] = await Promise.all([
      this.crossReferences.forPassage(scripture.passage),
      this.crossReferences.backlinksForPassage?.(scripture.passage) ?? Promise.resolve([]),
      this.annotations.forPassage(scripture.passage, scripture.translationId),
    ]);
    const lexicalKeys = [...new Set(scripture.verses.flatMap((v)=>v.tokens.map((t)=>t.strongs).filter((x): x is string => Boolean(x))))];
    return { passage: structuredClone(scripture.passage), crossReferenceCount: references.length, backlinkCount: backlinks.length, annotationCount: annotations.length, lexicalKeys };
  }
}
