import { compareVerseRefs } from '../../domain/references/reference.js';
import type { Study } from '../../domain/studies/types.js';
import type { SelahRepository } from '../../persistence/types.js';
import type { OutlineSection, StudyOutline } from './types.js';

const clone = <T>(value:T):T => structuredClone(value);

export function normalizeOutlineSections(study: Study, sections: OutlineSection[]): OutlineSection[] {
  const normalized=sections.map((section)=>({
    id:section.id,
    passage:clone(section.passage),
    label:section.label.trim(),
  })).sort((a,b)=>compareVerseRefs(a.passage.start,b.passage.start)||compareVerseRefs(a.passage.end,b.passage.end));

  for(const section of normalized){
    if(!section.id.trim())throw new Error('Outline section id is required');
    if(compareVerseRefs(section.passage.start,section.passage.end)>0)throw new Error('Outline section ends before it starts');
    if(compareVerseRefs(section.passage.start,study.primaryPassage.start)<0||compareVerseRefs(section.passage.end,study.primaryPassage.end)>0){
      throw new Error('Outline sections must stay inside the study passage');
    }
  }

  for(let i=1;i<normalized.length;i+=1){
    const previous=normalized[i-1]!;
    const current=normalized[i]!;
    if(compareVerseRefs(current.passage.start,previous.passage.end)<=0)throw new Error('Outline sections cannot overlap');
  }
  return normalized;
}

export class OutlineService {
  constructor(private readonly repository: SelahRepository) {}

  async get(studyId:string):Promise<StudyOutline|undefined>{
    return this.repository.getStudyOutline(studyId);
  }

  async save(study:Study,sections:OutlineSection[],now=Date.now()):Promise<StudyOutline>{
    const outline={studyId:study.id,sections:normalizeOutlineSections(study,sections),updatedAt:now};
    await this.repository.putStudyOutline(outline);
    return outline;
  }
}
