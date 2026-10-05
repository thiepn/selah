import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReference, formatPassage } from '../dist/src/domain/references/index.js';
import { MemorySelahRepository } from '../dist/src/persistence/index.js';
import { TopicOverviewService } from '../dist/src/study/topic-overview/index.js';
const p=(value)=>parseReference(value).passage;

test('topic overview derives only active studies with an exact case-insensitive manual topic',async()=>{
  const repo=new MemorySelahRepository(); await repo.initialize();
  await repo.putStudy({id:'a',primaryPassage:p('Phil 2:1-11'),title:'Humility in Christ',tags:['Humility','Christology'],archived:false,createdAt:1,updatedAt:3});
  await repo.putStudy({id:'b',primaryPassage:p('Rom 12:1-2'),title:'Living sacrifice',tags:['humility'],archived:false,createdAt:1,updatedAt:2});
  await repo.putStudy({id:'c',primaryPassage:p('1 Pet 5:5-7'),title:'Archived humility',tags:['Humility'],archived:true,createdAt:1,updatedAt:4});
  await repo.putStudy({id:'d',primaryPassage:p('Prov 11:2'),title:'Similar tag',tags:['Humility of wisdom'],archived:false,createdAt:1,updatedAt:1});
  const overview=await new TopicOverviewService(repo).overview('  #HUMILITY  ');
  assert.equal(overview.topic,'Humility');
  assert.deepEqual(overview.studies.map((study)=>study.id),['b','a']);
  assert.deepEqual(overview.books.map((book)=>[book.name,book.count]),[['Romans',1],['Philippians',1]]);
});

test('topic overview carries main ideas claims evidence and unresolved questions without generating a topic conclusion',async()=>{
  const repo=new MemorySelahRepository(); await repo.initialize();
  const passage=p('Phil 2:5-11');
  await repo.putStudy({id:'s1',primaryPassage:passage,title:'Christ hymn',tags:['Christology'],archived:false,createdAt:1,updatedAt:1});
  await repo.putStudySynthesis({studyId:'s1',mainIdea:'Christ humbles himself and is exalted.',explanation:'',evidence:'',application:'',prayer:'',confidence:'clear',updatedAt:1});
  await repo.putInterpretationClaim({id:'c1',studyId:'s1',statement:'Paul presents Christ’s self-humbling as exemplary.',confidence:'strong-inference',evidence:[{passage:p('Phil 2:5-8'),note:'The appeal and example are adjacent.'}],createdAt:1,updatedAt:1});
  await repo.putAnnotation({id:'q1',studyId:'s1',kind:'question',anchor:{type:'reference',passage},body:'How should μορφῇ be understood here?',tags:[],createdAt:1,updatedAt:1});
  await repo.putAnnotation({id:'q2',studyId:'s1',kind:'question',anchor:{type:'reference',passage},body:'Resolved?',response:'Yes',tags:[],createdAt:2,updatedAt:2});
  const overview=await new TopicOverviewService(repo).overview('Christology');
  assert.equal(overview.studies[0].mainIdea,'Christ humbles himself and is exalted.');
  assert.equal(overview.claims.length,1);
  assert.equal(overview.claims[0].confidence,'strong-inference');
  assert.equal(formatPassage(overview.claims[0].evidence[0].passage),'Philippians 2:5–8');
  assert.equal(overview.unresolvedQuestions.length,1);
  assert.match(overview.unresolvedQuestions[0].body,/μορφῇ/);
  assert.equal('understanding' in overview,false);
});
