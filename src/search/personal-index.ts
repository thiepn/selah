import { formatPassage } from '../domain/references/reference.js';
import type { Annotation, Study, StudyDocument } from '../domain/studies/types.js';

export type PersonalSearchKind = 'study' | 'document' | 'annotation';
export interface PersonalSearchResult {
  kind: PersonalSearchKind;
  studyId?: string;
  annotationId?: string;
  title: string;
  excerpt: string;
  score: number;
}

const normalize = (value: string) => value.toLocaleLowerCase('en').normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
const terms = (value: string) => normalize(value).split(' ').filter(Boolean);

interface IndexedItem extends PersonalSearchResult { normalized: string; }

export class PersonalStudySearchIndex {
  #items: IndexedItem[] = [];

  rebuild(input: { studies: Study[]; documents: StudyDocument[]; annotations: Annotation[] }): void {
    const studies = new Map(input.studies.map((study)=>[study.id,study]));
    this.#items = [];
    for (const study of input.studies) {
      const title=study.title??formatPassage(study.primaryPassage);
      const text=[title,...study.tags].join(' ');
      this.#items.push({kind:'study',studyId:study.id,title,excerpt:study.tags.join(' · '),score:0,normalized:normalize(text)});
    }
    for (const document of input.documents) {
      const study=studies.get(document.studyId);
      const title=study?.title??(study?formatPassage(study.primaryPassage):'Study document');
      this.#items.push({kind:'document',studyId:document.studyId,title,excerpt:document.plainText.slice(0,240),score:0,normalized:normalize(`${title} ${document.plainText}`)});
    }
    for (const annotation of input.annotations) {
      const study=annotation.studyId?studies.get(annotation.studyId):undefined;
      const title=study?.title??'Scripture annotation';
      const anchorText=annotation.anchor.type==='text'?annotation.anchor.quotedText:annotation.anchor.type==='reference'?formatPassage(annotation.anchor.passage):annotation.anchor.tokenIds.join(' ');
      const body=annotation.body??'';
      this.#items.push({kind:'annotation',...(annotation.studyId?{studyId:annotation.studyId}:{}),annotationId:annotation.id,title,excerpt:body||anchorText,score:0,normalized:normalize(`${title} ${anchorText} ${body} ${annotation.tags.join(' ')}`)});
    }
  }

  search(query: string, limit=40): PersonalSearchResult[] {
    const q=normalize(query); if(!q)return [];
    const qTerms=terms(q);
    return this.#items
      .filter((item)=>qTerms.every((term)=>item.normalized.includes(term)))
      .map((item)=>{const phrase=item.normalized.includes(q)?10:0;const prefix=item.normalized.startsWith(q)?3:0;return {...item,score:phrase+prefix+qTerms.length};})
      .sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title))
      .slice(0,limit)
      .map(({normalized:_normalized,...result})=>result);
  }
}
