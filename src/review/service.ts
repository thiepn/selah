import type { Study, StudySynthesis } from '../domain/studies/types.js';
import type { SelahRepository } from '../persistence/types.js';
import type { StudyOutline } from '../study/outline/types.js';
import { reviewCardDrafts, type ReviewCard, type ReviewRating } from './types.js';

const DAY=86_400_000;
const GOOD_INTERVALS=[1,7,30,90,180] as const;
const DIFFICULT_INTERVALS=[1,3,10,30,60] as const;

export interface ReviewServiceOptions {
  idFactory?: () => string;
  now?: () => number;
}

export class ReviewService {
  readonly #idFactory: () => string;
  readonly #now: () => number;

  constructor(private readonly repository: SelahRepository, options: ReviewServiceOptions = {}) {
    this.#idFactory=options.idFactory??(()=>crypto.randomUUID());
    this.#now=options.now??Date.now;
  }

  async due(now=this.#now()): Promise<ReviewCard[]> {
    const activeStudyIds=new Set((await this.repository.listStudies()).filter((study)=>!study.archived).map((study)=>study.id));
    return (await this.repository.listReviewCards())
      .filter((card)=>activeStudyIds.has(card.studyId)&&card.dueAt<=now)
      .sort((a,b)=>a.dueAt-b.dueAt||a.createdAt-b.createdAt);
  }

  async dueForStudy(studyId: string, now=this.#now()): Promise<ReviewCard[]> {
    return (await this.repository.listReviewCards(studyId))
      .filter((card)=>card.dueAt<=now)
      .sort((a,b)=>a.dueAt-b.dueAt||a.createdAt-b.createdAt);
  }

  async reconcileExisting(study: Study, synthesis: StudySynthesis, outline?: StudyOutline): Promise<{updated:number;deleted:number}> {
    const existing=await this.repository.listReviewCards(study.id);
    if(!existing.length)return {updated:0,deleted:0};
    const drafts=new Map(reviewCardDrafts(study,synthesis,outline).map((draft)=>[draft.source,draft]));
    let updated=0,deleted=0;
    for(const card of existing) {
      const draft=drafts.get(card.source);
      if(card.source==='custom') continue;
      if(!draft) {
        await this.repository.deleteReviewCard(card.id);
        deleted+=1;
        continue;
      }
      if(card.prompt!==draft.prompt||card.answer!==draft.answer) {
        await this.repository.putReviewCard({...card,prompt:draft.prompt,answer:draft.answer,updatedAt:this.#now()});
        updated+=1;
      }
    }
    return {updated,deleted};
  }

  async syncFromSynthesis(study: Study, synthesis: StudySynthesis, outline?: StudyOutline): Promise<{created:number;updated:number;deleted:number}> {
    const existing=await this.repository.listReviewCards(study.id);
    const bySource=new Map(existing.map((card)=>[card.source,card]));
    const drafts=reviewCardDrafts(study,synthesis,outline);
    const activeSources=new Set(drafts.map((draft)=>draft.source));
    let created=0,updated=0,deleted=0;
    for(const card of existing) {
      if(card.source!=='custom'&&!activeSources.has(card.source)) {
        await this.repository.deleteReviewCard(card.id);
        deleted+=1;
      }
    }
    for(const draft of drafts) {
      const current=bySource.get(draft.source);
      if(current) {
        if(current.prompt!==draft.prompt||current.answer!==draft.answer) {
          await this.repository.putReviewCard({...current,prompt:draft.prompt,answer:draft.answer,updatedAt:this.#now()});
          updated+=1;
        }
      } else {
        const now=this.#now();
        await this.repository.putReviewCard({
          id:this.#idFactory(),studyId:study.id,source:draft.source,prompt:draft.prompt,answer:draft.answer,
          stage:0,dueAt:now,history:[],createdAt:now,updatedAt:now,
        });
        created+=1;
      }
    }
    return {created,updated,deleted};
  }

  async createCustom(studyId: string, prompt: string, answer: string): Promise<ReviewCard> {
    const cleanPrompt=prompt.trim();
    const cleanAnswer=answer.trim();
    if(!cleanPrompt)throw new Error('Review question cannot be empty');
    if(!cleanAnswer)throw new Error('Review answer cannot be empty');
    if(cleanPrompt.length>300)throw new Error('Review question must be 300 characters or fewer');
    if(cleanAnswer.length>4000)throw new Error('Review answer must be 4000 characters or fewer');
    const study=await this.repository.getStudy(studyId);
    if(!study)throw new Error(`Study not found: ${studyId}`);
    const now=this.#now();
    const card:ReviewCard={
      id:this.#idFactory(),studyId,source:'custom',prompt:cleanPrompt,answer:cleanAnswer,
      stage:0,dueAt:now,history:[],createdAt:now,updatedAt:now,
    };
    await this.repository.putReviewCard(card);
    return card;
  }

  async updateCustom(id: string, prompt: string, answer: string): Promise<ReviewCard> {
    const card=await this.repository.getReviewCard(id);
    if(!card)throw new Error(`Review card not found: ${id}`);
    if(card.source!=='custom')throw new Error('Only custom review cards can be edited directly');
    const cleanPrompt=prompt.trim();
    const cleanAnswer=answer.trim();
    if(!cleanPrompt)throw new Error('Review question cannot be empty');
    if(!cleanAnswer)throw new Error('Review answer cannot be empty');
    if(cleanPrompt.length>300)throw new Error('Review question must be 300 characters or fewer');
    if(cleanAnswer.length>4000)throw new Error('Review answer must be 4000 characters or fewer');
    const updated={...card,prompt:cleanPrompt,answer:cleanAnswer,updatedAt:this.#now()};
    await this.repository.putReviewCard(updated);
    return updated;
  }

  async rate(id: string, rating: ReviewRating): Promise<ReviewCard> {
    const card=await this.repository.getReviewCard(id);
    if(!card)throw new Error(`Review card not found: ${id}`);
    const now=this.#now();
    let stage=card.stage;
    let days=1;
    if(rating==='forgot') {
      stage=0;
      days=1;
    } else if(rating==='difficult') {
      days=DIFFICULT_INTERVALS[Math.min(stage,DIFFICULT_INTERVALS.length-1)]!;
    } else {
      days=GOOD_INTERVALS[Math.min(stage,GOOD_INTERVALS.length-1)]!;
      stage=Math.min(stage+1,GOOD_INTERVALS.length);
    }
    const updated={...card,stage,dueAt:now+days*DAY,history:[...card.history,{at:now,rating}],updatedAt:now};
    await this.repository.putReviewCard(updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.repository.deleteReviewCard(id);
  }
}
