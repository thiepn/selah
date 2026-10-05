import { formatPassage } from '../domain/references/reference.js';
import type { Annotation, Study, StudyDocument, StudySynthesis } from '../domain/studies/types.js';
import type { ReviewCard } from '../review/types.js';

export type PersonalSearchKind = 'study' | 'document' | 'synthesis' | 'review' | 'annotation';
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

  rebuild(input: { studies: Study[]; documents: StudyDocument[]; syntheses?: StudySynthesis[]; reviewCards?: ReviewCard[]; annotations: Annotation[] }): void {
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
    for (const synthesis of input.syntheses ?? []) {
      const study=studies.get(synthesis.studyId);
      const title=study?.title??(study?formatPassage(study.primaryPassage):'Study synthesis');
      const text=[synthesis.mainIdea,synthesis.explanation,synthesis.evidence,synthesis.application,synthesis.prayer,synthesis.confidence].filter(Boolean).join(' ');
      const excerpt=synthesis.mainIdea||synthesis.explanation||synthesis.application||synthesis.prayer;
      this.#items.push({kind:'synthesis',studyId:synthesis.studyId,title,excerpt:excerpt.slice(0,240),score:0,normalized:normalize(`${title} ${text}`)});
    }
    for (const card of input.reviewCards ?? []) {
      const study=studies.get(card.studyId);
      const title=study?.title??(study?formatPassage(study.primaryPassage):'Review card');
      this.#items.push({kind:'review',studyId:card.studyId,title,excerpt:card.prompt,score:0,normalized:normalize(`${title} ${card.prompt} ${card.answer}`)});
    }
    for (const annotation of input.annotations) {
      const study=annotation.studyId?studies.get(annotation.studyId):undefined;
      const title=study?.title??'Scripture annotation';
      const anchorText=(annotation.anchor.type==='text'||annotation.anchor.type==='text-range')?annotation.anchor.quotedText:annotation.anchor.type==='reference'?formatPassage(annotation.anchor.passage):annotation.anchor.tokenIds.join(' ');
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
