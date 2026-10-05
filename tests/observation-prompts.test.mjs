import test from 'node:test';
import assert from 'node:assert/strict';
import { buildObservationPrompts } from '../dist/src/study/observation/index.js';
import { parseReference } from '../dist/src/domain/references/index.js';

const passage=parseReference('Phil 2:1-3').passage;
const scripture={
  translationId:'BSB',
  passage,
  verses:[
    {ref:passage.start,tokens:[{id:'t1',text:'Therefore ',language:'en'},{id:'t2',text:'if there is any encouragement in Christ, ',language:'en'},{id:'t3',text:'any comfort from love, ',language:'en'}]},
    {ref:{book:'PHP',chapter:2,verse:2},tokens:[{id:'t4',text:'make my joy complete by being like-minded, having the same love, ',language:'en'},{id:'t5',text:'being one in spirit and purpose. ',language:'en'}]},
    {ref:passage.end,tokens:[{id:'t6',text:'Do nothing out of selfish ambition or empty pride, but ',language:'en'},{id:'t7',text:'in humility consider others more important than yourselves.',language:'en'}]},
  ]
};

test('observation prompts ask about textual signals without supplying interpretations',()=>{
  const prompts=buildObservationPrompts(scripture);
  assert.equal(prompts[0].category,'baseline');
  assert.match(prompts[0].prompt,/explicitly say/);
  const repetition=prompts.find((prompt)=>prompt.category==='repetition'&&/love/i.test(prompt.prompt));
  assert.ok(repetition);
  assert.deepEqual(repetition.verses,[1,2]);
  assert.ok(repetition.tokenIds.length>=2);
  const inference=prompts.find((prompt)=>prompt.category==='logic'&&/conclusion follows/i.test(prompt.prompt));
  assert.ok(inference);
  const contrast=prompts.find((prompt)=>prompt.category==='logic'&&/contrasted/i.test(prompt.prompt));
  assert.ok(contrast);
  assert.equal(prompts.some((prompt)=>/therefore means|but means|the passage teaches/i.test(prompt.prompt)),false);
});

test('observation prompts always include an anti-assumption check',()=>{
  const prompts=buildObservationPrompts({...scripture,verses:[scripture.verses[0]]});
  assert.equal(prompts.at(-1).category,'limits');
  assert.match(prompts.at(-1).prompt,/not say/);
});
