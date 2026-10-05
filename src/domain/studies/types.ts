import type { PassageRef, VerseRef } from '../references/types.js';

export type StudyId = string;
export type LiteraryMode = 'narrative' | 'gospel' | 'law' | 'poetry' | 'wisdom' | 'prophecy' | 'epistle' | 'apocalyptic';
export type WorkspaceId = string;

export interface Study {
  id: StudyId;
  primaryPassage: PassageRef;
  title?: string;
  tags: string[];
  literaryMode?: LiteraryMode;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface StudyDocument {
  studyId: StudyId;
  format: 'plaintext' | 'tiptap-json';
  document: unknown;
  plainText: string;
  updatedAt: number;
}

export type SynthesisConfidence = 'clear' | 'strong-inference' | 'tentative' | 'needs-study';

export interface StudySynthesis {
  studyId: StudyId;
  mainIdea: string;
  explanation: string;
  evidence: string;
  application: string;
  prayer: string;
  confidence: SynthesisConfidence;
  updatedAt: number;
}

export type StudyTool = 'guide' | 'notes' | 'outline' | 'claims' | 'synthesis' | 'cross-references' | 'word-study' | 'compare' | 'resources' | 'phrasing';

export interface ResearchLocation {
  passage: PassageRef;
  activeVerse?: VerseRef;
  label?: string;
}

export interface ResearchTrail {
  entries: ResearchLocation[];
  index: number;
}

export interface WorkspacePane {
  id: string;
  tool: StudyTool;
  follow: 'passage' | 'selection' | 'pinned';
  pinnedPassage?: PassageRef;
  size?: number;
}

export interface WorkspaceState {
  id: WorkspaceId;
  studyId?: StudyId;
  primaryPassage: PassageRef;
  translationId: string;
  panes: WorkspacePane[];
  bibleScrollAnchor?: VerseRef;
  activeTool?: StudyTool;
  researchTrail: ResearchTrail;
  updatedAt: number;
}

export type AnnotationAnchor =
  | { type: 'reference'; passage: PassageRef }
  | {
      type: 'text';
      translationId: string;
      verse: VerseRef;
      startTokenId: string;
      endTokenId: string;
      quotedText: string;
      fingerprint?: string;
    }
  | {
      type: 'text-range';
      translationId: string;
      passage: PassageRef;
      startTokenId: string;
      endTokenId: string;
      quotedText: string;
      fingerprint?: string;
    }
  | {
      type: 'original-token';
      corpusId: string;
      tokenIds: string[];
    };

export type AnnotationKind = 'note' | 'highlight' | 'question';

export interface Annotation {
  id: string;
  studyId?: StudyId;
  kind: AnnotationKind;
  anchor: AnnotationAnchor;
  body?: string;
  response?: string;
  highlightStyle?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}
