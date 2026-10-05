import test from 'node:test';
import assert from 'node:assert/strict';
import { TranslationRegistry } from '../dist/src/research/compare/index.js';
import { exportStudyContextMarkdown } from '../dist/src/export/index.js';
import { parseReference } from '../dist/src/domain/references/index.js';

const passage = parseReference('Phil 2:6').passage;
const provider = (id,text) => ({
  translation:{id,name:id,abbreviation:id,language:'en',license:'test'},
  async getVerse(){return {ref:passage.start,tokens:[{id:`${id}-1`,text,language:'en'}]};},
  async getPassage(ref){return {translationId:id,passage:ref,verses:[{ref:ref.start,tokens:[{id:`${id}-1`,text,language:'en'}]}]};},
  async hasPassage(){return true;}
});

test('translation registry compares only registered available providers', async () => {
  const registry = new TranslationRegistry([provider('A','form of God'),provider('B','nature of God')]);
  const result = await registry.compare(passage,['A','B','MISSING']);
  assert.equal(result.translations.length,2);
  assert.deepEqual(result.unavailable,['MISSING']);
});

test('study-context export produces portable markdown and optional tutoring instructions', () => {
  const study={id:'s1',primaryPassage:passage,title:'Philippians 2:6',tags:[],archived:false,createdAt:1,updatedAt:1};
  const scripture={translationId:'BSB',passage,verses:[{ref:passage.start,tokens:[{id:'1',text:'existing ',language:'en'},{id:'2',text:'in the form of God',language:'en'}]}]};
  const synthesis={studyId:'s1',mainIdea:'Christ does not exploit equality with God.',explanation:'Paul grounds humble service in the pattern of Christ.',evidence:'Philippians 2:6',application:'Refuse status-seeking.',prayer:'Give me the mind of Christ.',confidence:'strong-inference',updatedAt:1};
  const outline={studyId:'s1',sections:[{id:'o1',passage,label:'Christ does not exploit equality with God'}],updatedAt:1};
  const markdown=exportStudyContextMarkdown({study,scripture,annotations:[{id:'a',kind:'note',anchor:{type:'reference',passage},body:'Observe the Christological claim.',tags:[],createdAt:1,updatedAt:1},{id:'q',kind:'question',anchor:{type:'reference',passage},body:'What grounds the appeal?',response:'Christ\'s pattern of humility.',tags:[],createdAt:1,updatedAt:1}],outline,synthesis,options:{tutorPrompt:'socratic'}});
  assert.match(markdown,/Selah Study Context/);
  assert.match(markdown,/Observe the Christological claim/);
  assert.match(markdown,/Response.*Christ's pattern of humility/s);
  assert.match(markdown,/Socratic Bible-study tutor/);
  assert.match(markdown,/Passage outline/);
  assert.match(markdown,/Christ does not exploit equality/);
  assert.match(markdown,/My synthesis/);
  assert.match(markdown,/Give me the mind of Christ/);
  assert.match(markdown,/strong-inference/);
});
