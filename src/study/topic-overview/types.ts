import type { PassageRef } from '../../domain/references/types.js';
import type { InterpretationConfidence, InterpretationEvidence } from '../claims/types.js';

export interface TopicOverviewBook { bookId:string; name:string; count:number; }
export interface TopicOverviewStudy { id:string; title:string; passage:PassageRef; mainIdea?:string; updatedAt:number; }
export interface TopicOverviewClaim {
  id:string; studyId:string; studyTitle:string; studyPassage:PassageRef;
  statement:string; confidence:InterpretationConfidence; evidence:InterpretationEvidence[];
}
export interface TopicOverviewQuestion { studyId:string; studyTitle:string; passage:PassageRef; body:string; }
export interface TopicOverview {
  topic:string;
  books:TopicOverviewBook[];
  studies:TopicOverviewStudy[];
  claims:TopicOverviewClaim[];
  unresolvedQuestions:TopicOverviewQuestion[];
}
