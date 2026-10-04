import type { PassageRef } from '../../domain/references/types.js';

export interface CrossReference {
  source: PassageRef;
  target: PassageRef;
  sourceDataset: string;
  weight?: number;
}

export interface CrossReferenceProvider {
  forPassage(passage: PassageRef): Promise<CrossReference[]>;
}
