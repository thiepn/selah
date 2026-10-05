import type { PassageRef } from '../../domain/references/types.js';

export interface OutlineSection {
  id: string;
  passage: PassageRef;
  label: string;
}

export interface StudyOutline {
  studyId: string;
  sections: OutlineSection[];
  updatedAt: number;
}
