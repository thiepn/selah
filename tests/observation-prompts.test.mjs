import test from 'node:test';
import assert from 'node:assert/strict';
import { buildObservationPrompts, defaultLiteraryMode } from '../dist/src/study/observation/index.js';
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


test('canonical book defaults cover the main literary study modes without preventing overrides',()=>{
  assert.equal(defaultLiteraryMode(parseReference('Gen 12:1-9').passage),'narrative');
  assert.equal(defaultLiteraryMode(parseReference('Exod 20:1-17').passage),'law');
  assert.equal(defaultLiteraryMode(parseReference('Ps 1:1-6').passage),'poetry');
  assert.equal(defaultLiteraryMode(parseReference('Prov 3:1-12').passage),'wisdom');
  assert.equal(defaultLiteraryMode(parseReference('Isa 6:1-8').passage),'prophecy');
  assert.equal(defaultLiteraryMode(parseReference('Matt 5:1-12').passage),'gospel');
  assert.equal(defaultLiteraryMode(parseReference('Rom 8:1-4').passage),'epistle');
  assert.equal(defaultLiteraryMode(parseReference('Rev 1:9-20').passage),'apocalyptic');
});

test('literary modes change observational questions without supplying interpretation',()=>{
  const samples=[
    ['narrative',/acts, speaks, or responds/i],
    ['gospel',/Jesus say or do/i],
    ['law',/command, prohibition, procedure/i],
    ['poetry',/lines echo, contrast, complete/i],
    ['wisdom',/observation, comparison, warning/i],
    ['prophecy',/accusation, warning, judgment/i],
    ['epistle',/claim or instruction/i],
    ['apocalyptic',/seen, heard, said, or explained/i],
  ];
  for(const [mode,expected] of samples){
    const prompts=buildObservationPrompts(scripture,mode);
    assert.equal(prompts.some((prompt)=>prompt.category==='literary'&&expected.test(prompt.prompt)),true,mode);
    assert.equal(prompts.at(-1).category,'limits',mode);
    assert.equal(prompts.some((prompt)=>/therefore means|the passage teaches|this symbolizes/i.test(prompt.prompt)),false,mode);
  }
});

test('anti-assumption check remains present even when a passage has many textual signals',()=>{
  const prompts=buildObservationPrompts(scripture,'epistle');
  assert.equal(prompts.at(-1).id,'limits-not-say');
  assert.equal(prompts.filter((prompt)=>prompt.category==='limits').length,1);
});
