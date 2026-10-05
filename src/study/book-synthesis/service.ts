import { BOOK_BY_ID } from '../../domain/references/books.js';
import { compareVerseRefs, formatPassage } from '../../domain/references/reference.js';
import type { SelahRepository } from '../../persistence/types.js';
import type { BookOverview, BookSynthesis } from './types.js';

export class BookSynthesisService {
  constructor(private readonly repository: SelahRepository) {}

  async get(bookId:string):Promise<BookSynthesis|undefined>{
    if(!BOOK_BY_ID.has(bookId))throw new Error(`Unknown Bible book: ${bookId}`);
    return this.repository.getBookSynthesis(bookId);
  }

  async save(bookId:string,understanding:string,now=Date.now()):Promise<BookSynthesis>{
    if(!BOOK_BY_ID.has(bookId))throw new Error(`Unknown Bible book: ${bookId}`);
    if(understanding.length>12_000)throw new Error('Book understanding must be 12,000 characters or fewer');
    const value={bookId,understanding,updatedAt:now};
    await this.repository.putBookSynthesis(value);
    return value;
  }
  async overview(bookId:string):Promise<BookOverview>{
    if(!BOOK_BY_ID.has(bookId))throw new Error(`Unknown Bible book: ${bookId}`);
    const studies=(await this.repository.listStudies())
      .filter((study)=>!study.archived&&study.primaryPassage.start.book===bookId)
      .sort((a,b)=>compareVerseRefs(a.primaryPassage.start,b.primaryPassage.start)||compareVerseRefs(a.primaryPassage.end,b.primaryPassage.end));
    const [saved,syntheses,annotationGroups]=await Promise.all([
      this.repository.getBookSynthesis(bookId),
      Promise.all(studies.map(async(study)=>({study,synthesis:await this.repository.getStudySynthesis(study.id)}))),
      Promise.all(studies.map(async(study)=>({study,annotations:await this.repository.listAnnotations(study.id)}))),
    ]);
    const topics=new Map<string,{label:string;count:number}>();
    for(const study of studies)for(const tag of study.tags){
      const key=tag.toLocaleLowerCase('en');
      const current=topics.get(key)??{label:tag,count:0};
      current.count+=1;
      topics.set(key,current);
    }
    const synthesisByStudy=new Map(syntheses.map((entry)=>[entry.study.id,entry.synthesis]));
    const unresolvedQuestions=annotationGroups.flatMap(({study,annotations})=>annotations
      .filter((annotation)=>annotation.kind==='question'&&!annotation.response?.trim())
      .map((annotation)=>({studyId:study.id,passage:structuredClone(study.primaryPassage),body:annotation.body??'Question'})));
    return {
      bookId,
      understanding:saved?.understanding??'',
      studies:studies.map((study)=>{
        const mainIdea=synthesisByStudy.get(study.id)?.mainIdea.trim();
        return {id:study.id,title:study.title??formatPassage(study.primaryPassage),passage:structuredClone(study.primaryPassage),...(mainIdea?{mainIdea}:{}),updatedAt:study.updatedAt};
      }),
      topics:[...topics.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,undefined,{sensitivity:'base'})),
      unresolvedQuestions,
    };
  }

}
