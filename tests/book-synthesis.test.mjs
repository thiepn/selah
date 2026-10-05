import test from 'node:test';
import assert from 'node:assert/strict';
import { MemorySelahRepository } from '../dist/src/persistence/index.js';
import { BookSynthesisService } from '../dist/src/study/book-synthesis/index.js';
import { parseReference } from '../dist/src/domain/references/index.js';

test('book synthesis persists one evolving personal understanding per canonical book',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  const service=new BookSynthesisService(repo);
  const first=await service.save('PHP','Christ-shaped humility and gospel partnership.',10);
  assert.equal(first.bookId,'PHP');
  assert.equal((await service.get('PHP')).understanding,first.understanding);
  const revised=await service.save('PHP','Joyful gospel partnership is shaped by the mind of Christ.',20);
  assert.equal(revised.updatedAt,20);
  assert.equal((await repo.listBookSyntheses()).length,1);
  assert.equal((await service.get('PHP')).understanding,revised.understanding);
});

test('book synthesis rejects unknown books and oversized understanding text',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  const service=new BookSynthesisService(repo);
  await assert.rejects(()=>service.save('NOPE','x'),/Unknown Bible book/);
  await assert.rejects(()=>service.save('PHP','x'.repeat(12001)),/12,000 characters/);
});


test('book overview derives active passage learning without duplicating study data',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  const php=parseReference('Phil 2:1-11').passage;
  const php2=parseReference('Phil 4:4-9').passage;
  const rom=parseReference('Rom 8:1-4').passage;
  await repo.putStudy({id:'p1',primaryPassage:php,title:'Christ-shaped humility',tags:['Christology','Humility'],archived:false,createdAt:1,updatedAt:3});
  await repo.putStudy({id:'p2',primaryPassage:php2,title:'Archived joy study',tags:['Joy'],archived:true,createdAt:1,updatedAt:2});
  await repo.putStudy({id:'r1',primaryPassage:rom,title:'Romans',tags:['Justification'],archived:false,createdAt:1,updatedAt:1});
  await repo.putStudySynthesis({studyId:'p1',mainIdea:'The church is called to the mind of Christ.',explanation:'',evidence:'',application:'',prayer:'',confidence:'clear',updatedAt:3});
  await repo.putAnnotation({id:'q1',studyId:'p1',kind:'question',anchor:{type:'reference',passage:php},body:'How does v. 9 relate to vv. 5-8?',tags:[],createdAt:1,updatedAt:1});
  await repo.putAnnotation({id:'q2',studyId:'p1',kind:'question',anchor:{type:'reference',passage:php},body:'What is the therefore doing?',response:'It marks the move to exaltation.',tags:[],createdAt:1,updatedAt:1});
  const service=new BookSynthesisService(repo);
  await service.save('PHP','Philippians calls the church into Christ-shaped gospel partnership.',4);
  const overview=await service.overview('PHP');
  assert.equal(overview.studies.length,1);
  assert.equal(overview.studies[0].id,'p1');
  assert.equal(overview.studies[0].mainIdea,'The church is called to the mind of Christ.');
  assert.deepEqual(overview.topics.map((x)=>[x.label,x.count]),[['Christology',1],['Humility',1]]);
  assert.equal(overview.unresolvedQuestions.length,1);
  assert.match(overview.unresolvedQuestions[0].body,/v\. 9/);
  assert.match(overview.understanding,/gospel partnership/);
});
