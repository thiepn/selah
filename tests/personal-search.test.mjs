import test from 'node:test';
import assert from 'node:assert/strict';
import { PersonalStudySearchIndex, ScriptureSearchIndex } from '../dist/src/search/index.js';
import { parseReference } from '../dist/src/domain/references/index.js';

const p=(x)=>parseReference(x).passage;

test('personal search finds study documents and anchored notes without dashboard metadata',()=>{
 const index=new PersonalStudySearchIndex();
 index.rebuild({
  studies:[{id:'s1',primaryPassage:p('Rom 8:1-4'),title:'Romans 8 — no condemnation',tags:['justification'],archived:false,createdAt:1,updatedAt:1}],
  documents:[{studyId:'s1',format:'tiptap-json',document:{},plainText:'Paul connects life in the Spirit with freedom from condemnation.',updatedAt:1}],
  outlines:[{studyId:'s1',sections:[{id:'o1',passage:p('Rom 8:1-2'),label:'No condemnation'},{id:'o2',passage:p('Rom 8:3-4'),label:'God fulfills the law'}],updatedAt:1}],
  syntheses:[{studyId:'s1',mainIdea:'Life in Christ means no condemnation.',explanation:'The Spirit brings freedom and life.',evidence:'Romans 8:1-4',application:'Walk according to the Spirit.',prayer:'Teach me to trust your verdict.',confidence:'clear',updatedAt:1}],
  reviewCards:[{id:'r1',studyId:'s1',source:'evidence',prompt:'What evidence supports Romans 8?',answer:'The Spirit sets believers free from condemnation.',stage:0,dueAt:1,history:[],createdAt:1,updatedAt:1}],
  annotations:[{id:'a1',studyId:'s1',kind:'note',anchor:{type:'reference',passage:p('Rom 8:1')},body:'Therefore points back to the preceding argument.',tags:[],createdAt:1,updatedAt:1},{id:'q1',studyId:'s1',kind:'question',anchor:{type:'reference',passage:p('Rom 8:1-4')},body:'Why is there no condemnation?',response:'Because God acted in Christ and the Spirit gives life.',tags:[],createdAt:1,updatedAt:1}]
 });
 assert.equal(index.search('Spirit freedom')[0].kind,'document');
 assert.equal(index.search('preceding argument')[0].kind,'annotation');
 assert.equal(index.search('God fulfills law')[0].kind,'outline');
 assert.equal(index.search('trust your verdict')[0].kind,'synthesis');
 assert.equal(index.search('evidence supports Romans')[0].kind,'review');
 assert.equal(index.search('Spirit gives life')[0].kind,'annotation');
});

test('scripture search index serialization round-trips without re-tokenizing',()=>{
 const index=new ScriptureSearchIndex();
 index.add({ref:{book:'JHN',chapter:1,verse:1},tokens:[{id:'1',text:'In the beginning was the Word',language:'en'}]});
 const restored=ScriptureSearchIndex.fromSerialized(index.serialize());
 assert.equal(restored.search('beginning Word')[0].canonicalId,'John.1.1');
});
