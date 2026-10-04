import type { PassageRef, VerseRef } from '../domain/references/types.js';
import type { Annotation, StudyId } from '../domain/studies/types.js';
import type { SelahRepository } from '../persistence/types.js';
import { annotationMatchesPassage, annotationVisibleInTranslation } from './anchor-matching.js';

export interface AnnotationServiceOptions {
  idFactory?: () => string;
  now?: () => number;
}

export class AnnotationService {
  readonly #idFactory: () => string;
  readonly #now: () => number;

  constructor(private readonly repository: SelahRepository, options: AnnotationServiceOptions = {}) {
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.#now = options.now ?? Date.now;
  }

  async createReferenceNote(passage: PassageRef, body: string, studyId?: StudyId): Promise<Annotation> {
    const timestamp = this.#now();
    const annotation: Annotation = {
      id: this.#idFactory(),
      kind: 'note',
      anchor: { type: 'reference', passage: structuredClone(passage) },
      body,
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(studyId ? { studyId } : {}),
    };
    await this.repository.putAnnotation(annotation);
    return annotation;
  }

  async createTextNote(input: {
    translationId: string;
    verse: VerseRef;
    startTokenId: string;
    endTokenId: string;
    quotedText: string;
    body: string;
    studyId?: StudyId;
  }): Promise<Annotation> {
    const timestamp = this.#now();
    const annotation: Annotation = {
      id: this.#idFactory(),
      kind: 'note',
      anchor: {
        type: 'text',
        translationId: input.translationId,
        verse: structuredClone(input.verse),
        startTokenId: input.startTokenId,
        endTokenId: input.endTokenId,
        quotedText: input.quotedText,
      },
      body: input.body,
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(input.studyId ? { studyId: input.studyId } : {}),
    };
    await this.repository.putAnnotation(annotation);
    return annotation;
  }


  async createHighlight(input: {
    translationId: string;
    verse: VerseRef;
    startTokenId: string;
    endTokenId: string;
    quotedText: string;
    highlightStyle?: string;
    studyId?: StudyId;
  }): Promise<Annotation> {
    const timestamp = this.#now();
    const annotation: Annotation = {
      id: this.#idFactory(),
      kind: 'highlight',
      anchor: {
        type: 'text',
        translationId: input.translationId,
        verse: structuredClone(input.verse),
        startTokenId: input.startTokenId,
        endTokenId: input.endTokenId,
        quotedText: input.quotedText,
      },
      highlightStyle: input.highlightStyle ?? 'default',
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(input.studyId ? { studyId: input.studyId } : {}),
    };
    await this.repository.putAnnotation(annotation);
    return annotation;
  }

  async createQuestion(passage: PassageRef, body: string, studyId?: StudyId): Promise<Annotation> {
    const timestamp = this.#now();
    const annotation: Annotation = {
      id: this.#idFactory(),
      kind: 'question',
      anchor: { type: 'reference', passage: structuredClone(passage) },
      body,
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(studyId ? { studyId } : {}),
    };
    await this.repository.putAnnotation(annotation);
    return annotation;
  }

  async update(id: string, patch: Pick<Partial<Annotation>, 'body' | 'tags' | 'highlightStyle'>): Promise<Annotation> {
    const existing = (await this.repository.listAnnotations()).find((annotation) => annotation.id === id);
    if (!existing) throw new Error(`Annotation not found: ${id}`);
    const updated: Annotation = { ...existing, ...structuredClone(patch), updatedAt: this.#now() };
    await this.repository.putAnnotation(updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.repository.deleteAnnotation(id);
  }

  async forPassage(passage: PassageRef, translationId: string, studyId?: StudyId): Promise<Annotation[]> {
    const annotations = await this.repository.listAnnotations(studyId);
    return annotations.filter((annotation) =>
      annotationMatchesPassage(annotation, passage) && annotationVisibleInTranslation(annotation, translationId),
    );
  }
}
