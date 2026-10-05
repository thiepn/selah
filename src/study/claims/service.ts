import { compareVerseRefs } from '../../domain/references/reference.js';
import type { PassageRef } from '../../domain/references/types.js';
import type { SelahRepository } from '../../persistence/types.js';
import type { InterpretationClaim, InterpretationConfidence, InterpretationEvidence } from './types.js';

const CONFIDENCE=new Set<InterpretationConfidence>(['explicit','strong-inference','tentative','disputed']);

function normalizeConfidence(value:InterpretationConfidence):InterpretationConfidence{
  if(!CONFIDENCE.has(value))throw new Error('Interpretation support level is invalid');
  return value;
}

export interface ClaimServiceOptions {
  idFactory?:()=>string;
  now?:()=>number;
}

function normalizeEvidence(items:InterpretationEvidence[],studyPassage:PassageRef):InterpretationEvidence[]{
  if(items.length>20)throw new Error('An interpretation claim can have at most 20 evidence references');
  const seen=new Set<string>();
  const result:InterpretationEvidence[]=[];
  for(const item of items){
    if(compareVerseRefs(item.passage.start,item.passage.end)>0)throw new Error('Evidence passage ends before it starts');
    if(compareVerseRefs(item.passage.start,studyPassage.start)<0||compareVerseRefs(item.passage.end,studyPassage.end)>0)throw new Error('Claim evidence must stay inside the study passage');
    const key=`${item.passage.start.book}.${item.passage.start.chapter}.${item.passage.start.verse}-${item.passage.end.book}.${item.passage.end.chapter}.${item.passage.end.verse}`;
    if(seen.has(key))continue;
    seen.add(key);
    const note=item.note?.trim();
    if(note&&note.length>500)throw new Error('Evidence note must be 500 characters or fewer');
    result.push({passage:structuredClone(item.passage),...(note?{note}: {})});
  }
  return result;
}

function normalizeStatement(statement:string):string{
  const value=statement.trim();
  if(!value)throw new Error('Interpretation claim cannot be empty');
  if(value.length>2000)throw new Error('Interpretation claim must be 2,000 characters or fewer');
  return value;
}

export class InterpretationClaimService {
  readonly #idFactory:()=>string;
  readonly #now:()=>number;

  constructor(private readonly repository:SelahRepository,options:ClaimServiceOptions={}){
    this.#idFactory=options.idFactory??(()=>crypto.randomUUID());
    this.#now=options.now??Date.now;
  }

  async list(studyId:string):Promise<InterpretationClaim[]>{
    return (await this.repository.listInterpretationClaims(studyId)).sort((a,b)=>a.createdAt-b.createdAt);
  }

  async create(studyId:string,input:{statement:string;confidence:InterpretationConfidence;evidence?:InterpretationEvidence[]}):Promise<InterpretationClaim>{
    const study=await this.repository.getStudy(studyId);
    if(!study)throw new Error(`Study not found: ${studyId}`);
    const now=this.#now();
    const claim:InterpretationClaim={
      id:this.#idFactory(),
      studyId,
      statement:normalizeStatement(input.statement),
      confidence:normalizeConfidence(input.confidence),
      evidence:normalizeEvidence(input.evidence??[],study.primaryPassage),
      createdAt:now,
      updatedAt:now,
    };
    await this.repository.putInterpretationClaim(claim);
    return claim;
  }

  async update(id:string,input:Partial<Pick<InterpretationClaim,'statement'|'confidence'|'evidence'>>):Promise<InterpretationClaim>{
    const existing=await this.repository.getInterpretationClaim(id);
    if(!existing)throw new Error(`Interpretation claim not found: ${id}`);
    const study=await this.repository.getStudy(existing.studyId);
    if(!study)throw new Error(`Study not found: ${existing.studyId}`);
    const updated:InterpretationClaim={
      ...existing,
      ...(input.statement!==undefined?{statement:normalizeStatement(input.statement)}:{}),
      ...(input.confidence!==undefined?{confidence:normalizeConfidence(input.confidence)}:{}),
      ...(input.evidence!==undefined?{evidence:normalizeEvidence(input.evidence,study.primaryPassage)}:{}),
      updatedAt:this.#now(),
    };
    await this.repository.putInterpretationClaim(updated);
    return updated;
  }

  async remove(id:string):Promise<void>{
    await this.repository.deleteInterpretationClaim(id);
  }
}
