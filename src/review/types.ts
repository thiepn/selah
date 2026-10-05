import type { Study, StudyId, StudySynthesis } from '../domain/studies/types.js';
import { formatPassage } from '../domain/references/reference.js';

export type ReviewRating = 'forgot' | 'difficult' | 'good';
export type ReviewCardSource = 'main-idea' | 'explanation' | 'evidence' | 'application';

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

export function reviewCardDrafts(study: Study, synthesis: StudySynthesis): ReviewCardDraft[] {
  const reference=formatPassage(study.primaryPassage);
  return [
    {source:'main-idea',prompt:`What is the main idea of ${reference}?`,answer:synthesis.mainIdea.trim()},
    {source:'explanation',prompt:`How would you explain ${reference} in your own words?`,answer:synthesis.explanation.trim()},
    {source:'evidence',prompt:`What textual evidence supports your reading of ${reference}?`,answer:synthesis.evidence.trim()},
    {source:'application',prompt:`What application did you draw from ${reference}?`,answer:synthesis.application.trim()},
  ].filter((card)=>card.answer);
}
