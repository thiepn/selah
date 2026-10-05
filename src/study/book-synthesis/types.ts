import type { PassageRef } from '../../domain/references/types.js';

export interface BookSynthesis {
  bookId: string;
  understanding: string;
  updatedAt: number;
}

export interface BookOverviewStudy {
  id: string;
  title: string;
  passage: PassageRef;
  mainIdea?: string;
  updatedAt: number;
}

export interface BookOverviewTopic {
  label: string;
  count: number;
}

export interface BookOverviewQuestion {
  studyId: string;
  passage: PassageRef;
  body: string;
}

export interface BookOverview {
  bookId: string;
  understanding: string;
  studies: BookOverviewStudy[];
  topics: BookOverviewTopic[];
  unresolvedQuestions: BookOverviewQuestion[];
}
