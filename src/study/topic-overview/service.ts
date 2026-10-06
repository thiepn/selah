import { BOOK_BY_ID } from '../../domain/references/books.js';
import { compareVerseRefs, formatPassage } from '../../domain/references/reference.js';
import type { SelahRepository } from '../../persistence/types.js';
import { normalizeStudyTags } from '../study-service.js';
import type { TopicOverview } from './types.js';

export class TopicOverviewService {
  constructor(private readonly repository: SelahRepository) {}

  async overview(rawTopic:string):Promise<TopicOverview>{
    const topic=normalizeStudyTags([rawTopic])[0];
    if(!topic)throw new Error('Topic cannot be empty');
    const key=topic.toLocaleLowerCase('en');
    const studies=(await this.repository.listStudies())
      .filter((study)=>!study.archived&&study.tags.some((tag)=>tag.toLocaleLowerCase('en')===key))
      .sort((a,b)=>compareVerseRefs(a.primaryPassage.start,b.primaryPassage.start)||compareVerseRefs(a.primaryPassage.end,b.primaryPassage.end)||b.updatedAt-a.updatedAt);
    const label=[...studies].sort((a,b)=>b.updatedAt-a.updatedAt).flatMap((study)=>study.tags).find((tag)=>tag.toLocaleLowerCase('en')===key)??topic;
    const rows=await Promise.all(studies.map(async(study)=>({
      study,
      synthesis:await this.repository.getStudySynthesis(study.id),
      claims:await this.repository.listInterpretationClaims(study.id),
      annotations:await this.repository.listAnnotations(study.id),
    })));
    const books=new Map();
    for(const study of studies){
      const book=BOOK_BY_ID.get(study.primaryPassage.start.book);
      if(!book)continue;
      const current=books.get(book.id)??{bookId:book.id,name:book.name,count:0};
      current.count+=1;
      books.set(book.id,current);
    }
    return {
      topic:label,
      books:[...books.values()].sort((a,b)=>(BOOK_BY_ID.get(a.bookId)?.order??999)-(BOOK_BY_ID.get(b.bookId)?.order??999)),
      studies:rows.map(({study,synthesis})=>{
        const mainIdea=synthesis?.mainIdea.trim();
        return {id:study.id,title:study.title??formatPassage(study.primaryPassage),passage:structuredClone(study.primaryPassage),...(mainIdea?{mainIdea}:{}),updatedAt:study.updatedAt};
      }),
      claims:rows.flatMap(({study,claims})=>claims.sort((a,b)=>a.createdAt-b.createdAt).map((claim)=>({
        id:claim.id,studyId:study.id,studyTitle:study.title??formatPassage(study.primaryPassage),
        studyPassage:structuredClone(study.primaryPassage),statement:claim.statement,confidence:claim.confidence,evidence:structuredClone(claim.evidence),
      }))),
      unresolvedQuestions:rows.flatMap(({study,annotations})=>annotations
        .filter((annotation)=>annotation.kind==='question'&&!annotation.response?.trim())
        .sort((a,b)=>a.createdAt-b.createdAt)
        .map((annotation)=>({studyId:study.id,studyTitle:study.title??formatPassage(study.primaryPassage),passage:structuredClone(study.primaryPassage),body:annotation.body??'Question'}))),
    };
  }
}
