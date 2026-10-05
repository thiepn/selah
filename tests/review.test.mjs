import test from 'node:test';
import assert from 'node:assert/strict';
import { MemorySelahRepository } from '../dist/src/persistence/index.js';
import { ReviewService, reviewCardDrafts } from '../dist/src/review/index.js';
import { parseReference } from '../dist/src/domain/references/index.js';

const passage=parseReference('Phil 2:5-11').passage;
const study={id:'s1',primaryPassage:passage,tags:[],archived:false,createdAt:1,updatedAt:1};
const synthesis={studyId:'s1',mainIdea:'Christ is the pattern of humble obedience.',explanation:'Paul points to Christ to shape the church\'s mindset.',evidence:'Philippians 2:5-11 moves from humiliation to exaltation.',application:'Serve without status-seeking.',prayer:'Give me the mind of Christ.',confidence:'clear',updatedAt:1};

test('review drafts come only from durable synthesis learning claims',()=>{
  const drafts=reviewCardDrafts(study,synthesis);
  assert.deepEqual(drafts.map((x)=>x.source),['main-idea','explanation','evidence','application']);
  assert.equal(drafts.some((x)=>x.answer.includes('Give me the mind')),false);
});

test('review scheduler follows good ladder and resets forgotten cards',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  await repo.putStudy(study);
  let now=1_000_000;
  let seq=0;
  const service=new ReviewService(repo,{now:()=>now,idFactory:()=>`r${++seq}`});
  const synced=await service.syncFromSynthesis(study,synthesis);
  assert.equal(synced.created,4);
  assert.equal((await service.due()).length,4);

  const card=(await repo.listReviewCards('s1'))[0];
  const oneDay=86_400_000;
  const afterGood=await service.rate(card.id,'good');
  assert.equal(afterGood.stage,1);
  assert.equal(afterGood.dueAt,now+oneDay);

  now+=oneDay;
  const afterSecondGood=await service.rate(card.id,'good');
  assert.equal(afterSecondGood.stage,2);
  assert.equal(afterSecondGood.dueAt,now+7*oneDay);

  const forgotten=await service.rate(card.id,'forgot');
  assert.equal(forgotten.stage,0);
  assert.equal(forgotten.dueAt,now+oneDay);
  assert.deepEqual(forgotten.history.map((x)=>x.rating),['good','good','forgot']);
});

test('sync updates answers without destroying review progress',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  await repo.putStudy(study);
  let now=5;
  const service=new ReviewService(repo,{now:()=>now,idFactory:()=>crypto.randomUUID()});
  await service.syncFromSynthesis(study,synthesis);
  const card=(await repo.listReviewCards('s1')).find((x)=>x.source==='main-idea');
  await service.rate(card.id,'good');
  now=10;
  const revised={...synthesis,mainIdea:'Christ-shaped humility governs Christian community.'};
  const result=await service.syncFromSynthesis(study,revised);
  const updated=await repo.getReviewCard(card.id);
  assert.equal(result.updated,1);
  assert.equal(updated.answer,revised.mainIdea);
  assert.equal(updated.stage,1);
  assert.equal(updated.history.length,1);
});


test('completed outline becomes a durable structure review card',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  await repo.putStudy(study);
  const outline={studyId:'s1',sections:[
    {id:'o1',passage:parseReference('Phil 2:5-8').passage,label:'Christ humbles himself'},
    {id:'o2',passage:parseReference('Phil 2:9-11').passage,label:'God exalts Christ'},
  ],updatedAt:1};
  const drafts=reviewCardDrafts(study,synthesis,outline);
  const structure=drafts.find((x)=>x.source==='outline');
  assert.match(structure.answer,/Philippians 2:5–8 — Christ humbles himself/);
  const service=new ReviewService(repo,{now:()=>1,idFactory:()=>crypto.randomUUID()});
  const synced=await service.syncFromSynthesis(study,synthesis,outline);
  assert.equal(synced.created,5);
  assert.equal((await repo.listReviewCards('s1')).some((x)=>x.source==='outline'),true);
});
