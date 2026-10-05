import type { PassageRef } from '../../domain/references/types.js';

export type InterpretationConfidence = 'explicit' | 'strong-inference' | 'tentative' | 'disputed';

export interface InterpretationEvidence {
  passage: PassageRef;
  note?: string;
}

export interface InterpretationClaim {
  id: string;
  studyId: string;
  statement: string;
  confidence: InterpretationConfidence;
  evidence: InterpretationEvidence[];
  createdAt: number;
  updatedAt: number;
}
