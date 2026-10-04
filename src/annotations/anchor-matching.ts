import { compareVerseRefs } from '../domain/references/reference.js';
import type { PassageRef } from '../domain/references/types.js';
import type { Annotation, AnnotationAnchor } from '../domain/studies/types.js';

export function passagesOverlap(a: PassageRef, b: PassageRef): boolean {
  return compareVerseRefs(a.start, b.end) <= 0 && compareVerseRefs(b.start, a.end) <= 0;
}

export function anchorPassage(anchor: AnnotationAnchor): PassageRef | undefined {
  if (anchor.type === 'reference') return anchor.passage;
  if (anchor.type === 'text') return { start: anchor.verse, end: anchor.verse };
  if (anchor.type === 'text-range') return anchor.passage;
  return undefined;
}

export function annotationMatchesPassage(annotation: Annotation, passage: PassageRef): boolean {
  const anchored = anchorPassage(annotation.anchor);
  return anchored ? passagesOverlap(anchored, passage) : false;
}

export function annotationVisibleInTranslation(annotation: Annotation, translationId: string): boolean {
  return (annotation.anchor.type !== 'text' && annotation.anchor.type !== 'text-range') || annotation.anchor.translationId === translationId;
}
