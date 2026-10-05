import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReference } from '../dist/src/domain/references/index.js';
import { MemorySelahRepository } from '../dist/src/persistence/index.js';
import { InterpretationClaimService } from '../dist/src/study/claims/index.js';

const p=(value)=>parseReference(value).passage;
const study={id:'s1',primaryPassage:p('Phil 2:5-11'),title:'Christ hymn',tags:[],archived:false,createdAt:1,updatedAt:1};

test('interpretation claims normalize statements evidence and support level',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  await repo.putStudy(study);
  let now=10;
  const service=new InterpretationClaimService(repo,{idFactory:()=> 'c1',now:()=>now});
  const claim=await service.create('s1',{
    statement:'  Christ’s humiliation grounds Paul’s appeal to humility.  ',
    confidence:'strong-inference',
    evidence:[
      {passage:p('Phil 2:5-8'),note:'  Paul points to the mind of Christ.  '},
      {passage:p('Phil 2:5-8'),note:'duplicate should collapse'},
      {passage:p('Phil 2:9-11')},
    ],
  });
  assert.equal(claim.statement,'Christ’s humiliation grounds Paul’s appeal to humility.');
  assert.equal(claim.confidence,'strong-inference');
  assert.equal(claim.evidence.length,2);
  assert.equal(claim.evidence[0].note,'Paul points to the mind of Christ.');
  assert.equal(claim.createdAt,10);
});

test('claim evidence must remain inside the studied passage',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  await repo.putStudy(study);
  const service=new InterpretationClaimService(repo,{idFactory:()=> 'c2',now:()=>1});
  await assert.rejects(()=>service.create('s1',{
    statement:'A claim',
    confidence:'tentative',
    evidence:[{passage:p('Phil 2:4-6')}],
  }),/inside the study passage/);
  await assert.rejects(()=>service.create('s1',{
    statement:'A claim',
    confidence:'tentative',
    evidence:[{passage:p('Phil 3:1')}],
  }),/inside the study passage/);
});

test('claim service rejects invalid runtime support values and oversized inputs',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  await repo.putStudy(study);
  const service=new InterpretationClaimService(repo,{idFactory:()=> 'c3',now:()=>1});
  await assert.rejects(()=>service.create('s1',{statement:'A claim',confidence:'certain',evidence:[]}),/support level is invalid/);
  await assert.rejects(()=>service.create('s1',{statement:'x'.repeat(2001),confidence:'explicit',evidence:[]}),/2,000 characters/);
  await assert.rejects(()=>service.create('s1',{statement:'A claim',confidence:'explicit',evidence:[{passage:p('Phil 2:5'),note:'x'.repeat(501)}]}),/500 characters/);
});

test('claims update without changing ownership or creation time',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  await repo.putStudy(study);
  let now=5;
  const service=new InterpretationClaimService(repo,{idFactory:()=> 'c4',now:()=>now});
  const original=await service.create('s1',{statement:'Initial claim',confidence:'tentative',evidence:[{passage:p('Phil 2:5-6')}]});
  now=20;
  const updated=await service.update(original.id,{statement:'Revised claim',confidence:'explicit',evidence:[{passage:p('Phil 2:5')}]});
  assert.equal(updated.studyId,'s1');
  assert.equal(updated.createdAt,5);
  assert.equal(updated.updatedAt,20);
  assert.equal(updated.statement,'Revised claim');
  assert.equal(updated.confidence,'explicit');
});

test('deleting a study cascades all study-owned claim and note state but preserves book synthesis',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  await repo.putStudy(study);
  await repo.putStudyDocument({studyId:'s1',format:'plaintext',document:{},plainText:'notes',updatedAt:1});
  await repo.putStudySynthesis({studyId:'s1',mainIdea:'main',explanation:'',evidence:'',application:'',prayer:'',confidence:'clear',updatedAt:1});
  await repo.putStudyOutline({studyId:'s1',sections:[],updatedAt:1});
  await repo.putBookSynthesis({bookId:'PHP',understanding:'book-level understanding',updatedAt:1});
  await repo.putInterpretationClaim({id:'c5',studyId:'s1',statement:'claim',confidence:'explicit',evidence:[{passage:p('Phil 2:5')}],createdAt:1,updatedAt:1});
  await repo.putReviewCard({id:'r1',studyId:'s1',source:'custom',prompt:'q',answer:'a',stage:0,dueAt:1,history:[],createdAt:1,updatedAt:1});
  await repo.putAnnotation({id:'a1',studyId:'s1',kind:'note',anchor:{type:'reference',passage:p('Phil 2:5')},body:'note',tags:[],createdAt:1,updatedAt:1});
  await repo.putPhrasingDocument({id:'p1',studyId:'s1',passage:p('Phil 2:5-6'),rootIds:[],nodes:{},updatedAt:1});
  await repo.putWorkspace({id:'w1',primaryPassage:p('Phil 2:5-11'),translationId:'BSB',studyId:'s1',researchTrail:{entries:[],index:-1},createdAt:1,updatedAt:1});
  await repo.deleteStudy('s1');
  assert.equal(await repo.getStudy('s1'),undefined);
  assert.equal(await repo.getStudyDocument('s1'),undefined);
  assert.equal(await repo.getStudySynthesis('s1'),undefined);
  assert.equal(await repo.getStudyOutline('s1'),undefined);
  assert.deepEqual(await repo.listInterpretationClaims('s1'),[]);
  assert.deepEqual(await repo.listReviewCards('s1'),[]);
  assert.deepEqual(await repo.listAnnotations('s1'),[]);
  assert.deepEqual(await repo.listPhrasingDocuments('s1'),[]);
  assert.equal((await repo.listWorkspaces()).some((workspace)=>workspace.studyId==='s1'),false);
  assert.equal((await repo.getBookSynthesis('PHP')).understanding,'book-level understanding');
});


test('high-confidence claims require at least one exact evidence reference',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  await repo.putStudy(study);
  const service=new InterpretationClaimService(repo,{idFactory:()=> 'c6',now:()=>1});
  await assert.rejects(()=>service.create('s1',{statement:'Explicit claim',confidence:'explicit',evidence:[]}),/require textual evidence/);
  await assert.rejects(()=>service.create('s1',{statement:'Strong claim',confidence:'strong-inference',evidence:[]}),/require textual evidence/);
  const tentative=await service.create('s1',{statement:'Working hypothesis',confidence:'tentative',evidence:[]});
  assert.equal(tentative.evidence.length,0);
  await assert.rejects(()=>service.update(tentative.id,{confidence:'explicit'}),/require textual evidence/);
  const promoted=await service.update(tentative.id,{confidence:'explicit',evidence:[{passage:p('Phil 2:5-8')}]});
  assert.equal(promoted.confidence,'explicit');
});
