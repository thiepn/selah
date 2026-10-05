import type { Study, StudyId, StudySynthesis } from '../domain/studies/types.js';
import { formatPassage } from '../domain/references/reference.js';
import type { StudyOutline } from '../study/outline/types.js';

export type ReviewRating = 'forgot' | 'difficult' | 'good';
export type ReviewCardSource = 'main-idea' | 'outline' | 'explanation' | 'evidence' | 'application' | 'custom';

export interface ReviewAttempt {
  at: number;
  rating: ReviewRating;
}

export interface ReviewCard {
  id: string;
  studyId: StudyId;
  source: ReviewCardSource;
  prompt: string;
  answer: string;
  stage: number;
  dueAt: number;
  history: ReviewAttempt[];
  createdAt: number;
  updatedAt: number;
}

export interface ReviewCardDraft {
  source: ReviewCardSource;
  prompt: string;
  answer: string;
}

export function reviewCardDrafts(study: Study, synthesis: StudySynthesis, outline?: StudyOutline): ReviewCardDraft[] {
  const reference=formatPassage(study.primaryPassage);
  const outlineAnswer=outline&&outline.sections.length>=2&&outline.sections.every((section)=>section.label.trim())
    ? outline.sections.map((section)=>`${formatPassage(section.passage)} — ${section.label.trim()}`).join('\n')
    : '';
  const drafts: ReviewCardDraft[] = [
    {source:'main-idea',prompt:`What is the main idea of ${reference}?`,answer:synthesis.mainIdea.trim()},
    {source:'outline',prompt:`How would you divide ${reference} into sections?`,answer:outlineAnswer},
    {source:'explanation',prompt:`How would you explain ${reference} in your own words?`,answer:synthesis.explanation.trim()},
    {source:'evidence',prompt:`What textual evidence supports your reading of ${reference}?`,answer:synthesis.evidence.trim()},
    {source:'application',prompt:`What application did you draw from ${reference}?`,answer:synthesis.application.trim()},
  ];
  return drafts.filter((card)=>card.answer);
}
