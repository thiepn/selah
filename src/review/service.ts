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
    return (await this.repository.listReviewCards())
      .filter((card)=>card.dueAt<=now)
      .sort((a,b)=>a.dueAt-b.dueAt||a.createdAt-b.createdAt);
  }

  async syncFromSynthesis(study: Study, synthesis: StudySynthesis, outline?: StudyOutline): Promise<{created:number;updated:number;deleted:number}> {
    const existing=await this.repository.listReviewCards(study.id);
    const bySource=new Map(existing.map((card)=>[card.source,card]));
    const drafts=reviewCardDrafts(study,synthesis,outline);
    const activeSources=new Set(drafts.map((draft)=>draft.source));
    let created=0,updated=0,deleted=0;
    for(const card of existing) {
      if(!activeSources.has(card.source)) {
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
