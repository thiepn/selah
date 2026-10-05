import type { PhrasingDocument } from '../bible/phrasing/model.js';
import type { ReviewCard } from '../review/types.js';
import type { StudyOutline } from '../study/outline/types.js';
import type { Annotation, Study, StudyDocument, StudySynthesis, WorkspaceState } from '../domain/studies/types.js';

export const APP_SCHEMA_VERSION = 5;
export const DATA_SCHEMA_VERSION = 1;

export interface SelahSettings {
  id: 'settings';
  theme: 'light' | 'dark' | 'system';
  primaryTranslationId: string;
  fontScale: number;
}

export interface SelahMetadata {
  id: 'metadata';
  appSchemaVersion: number;
  dataSchemaVersion: number;
  bibleDatasetVersion?: string;
  lastOpenedWorkspaceId?: string;
  updatedAt: number;
}

export interface SelahSnapshot {
  metadata: SelahMetadata;
  settings: SelahSettings;
  studies: Study[];
  studyDocuments: StudyDocument[];
  studySyntheses: StudySynthesis[];
  studyOutlines: StudyOutline[];
  reviewCards: ReviewCard[];
  annotations: Annotation[];
  workspaceStates: WorkspaceState[];
  phrasingDocuments: PhrasingDocument[];
}

export interface SelahRepository {
  initialize(): Promise<void>;
  getMetadata(): Promise<SelahMetadata>;
  setMetadata(metadata: SelahMetadata): Promise<void>;
  getSettings(): Promise<SelahSettings>;
  setSettings(settings: SelahSettings): Promise<void>;

  listStudies(): Promise<Study[]>;
  getStudy(id: string): Promise<Study | undefined>;
  putStudy(study: Study): Promise<void>;
  deleteStudy(id: string): Promise<void>;

  getStudyDocument(studyId: string): Promise<StudyDocument | undefined>;
  putStudyDocument(document: StudyDocument): Promise<void>;
  getStudySynthesis(studyId: string): Promise<StudySynthesis | undefined>;
  putStudySynthesis(synthesis: StudySynthesis): Promise<void>;
  getStudyOutline(studyId: string): Promise<StudyOutline | undefined>;
  putStudyOutline(outline: StudyOutline): Promise<void>;

  listReviewCards(studyId?: string): Promise<ReviewCard[]>;
  getReviewCard(id: string): Promise<ReviewCard | undefined>;
  putReviewCard(card: ReviewCard): Promise<void>;
  deleteReviewCard(id: string): Promise<void>;

  listAnnotations(studyId?: string): Promise<Annotation[]>;
  putAnnotation(annotation: Annotation): Promise<void>;
  deleteAnnotation(id: string): Promise<void>;

  listWorkspaces(): Promise<WorkspaceState[]>;
  getWorkspace(id: string): Promise<WorkspaceState | undefined>;
  putWorkspace(workspace: WorkspaceState): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;

  listPhrasingDocuments(studyId?: string): Promise<PhrasingDocument[]>;
  getPhrasingDocument(id: string): Promise<PhrasingDocument | undefined>;
  putPhrasingDocument(document: PhrasingDocument): Promise<void>;
  deletePhrasingDocument(id: string): Promise<void>;

  exportSnapshot(): Promise<SelahSnapshot>;
  importSnapshot(snapshot: SelahSnapshot, mode?: 'replace' | 'merge'): Promise<void>;
}
