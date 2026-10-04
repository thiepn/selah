import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePatterns, analyzeStructuralMarkers } from '../dist/src/bible/patterns/index.js';
import { indentPhrase, splitPhraseNode, mergePhraseWithPrevious } from '../dist/src/bible/phrasing/index.js';
import { parseReference } from '../dist/src/domain/references/index.js';
import { BsbPdCrossReferenceProvider } from '../dist/src/research/cross-references/index.js';
import { AnnotationService } from '../dist/src/annotations/index.js';
import { MemorySelahRepository } from '../dist/src/persistence/index.js';
import { PassageGuideService } from '../dist/src/study/guide/index.js';

const p=(x)=>parseReference(x).passage;

test('patterns find repeated textual and lexical signals without interpreting them', () => {
  const scripture={translationId:'BSB',passage:p('Phil 2:6-7'),verses:[
    {ref:p('Phil 2:6').start,tokens:[{id:'1',text:'form',strongs:'G3444',language:'en'},{id:'2',text:'God',strongs:'G2316',language:'en'}]},
    {ref:p('Phil 2:7').start,tokens:[{id:'3',text:'form',strongs:'G3444',language:'en'},{id:'4',text:'servant',strongs:'G1401',language:'en'}]},
  ]};
  const patterns=analyzePatterns(scripture);
  assert.ok(patterns.some((x)=>x.type==='word' && x.key==='form' && x.count===2));
  assert.ok(patterns.some((x)=>x.type==='strongs' && x.key==='G3444' && x.count===2));
});

test('phrasing indentation creates explicit hierarchy without changing token identity', () => {
  const nodes=[{id:'a',tokenIds:['1'],children:[]},{id:'b',tokenIds:['2'],children:[]}];
  const result=indentPhrase(nodes,'b');
  assert.equal(result.length,1);
  assert.equal(result[0].children[0].id,'b');
  assert.deepEqual(result[0].children[0].tokenIds,['2']);
});

test('BSB cross-reference provider normalizes verse links', async () => {
  const jsonl=JSON.stringify({id:'PHP.2.10',b:'PHP',c:2,v:10,x:['ISA.45.23','ROM.14.11']});
  const provider=new BsbPdCrossReferenceProvider(jsonl);
  const refs=await provider.forPassage(p('Phil 2:10'));
  assert.equal(refs.length,2);
  assert.equal(refs[0].target.start.book,'ISA');
  assert.equal(refs[1].target.start.book,'ROM');
});

test('phrasing can indent and outdent nested units without changing token ids', async () => {
  const { outdentPhrase } = await import('../dist/src/bible/phrasing/index.js');
  const nodes=[{id:'a',tokenIds:['1'],children:[]},{id:'b',tokenIds:['2'],children:[]}];
  const nested=indentPhrase(nodes,'b');
  const flat=outdentPhrase(nested,'b');
  assert.deepEqual(flat.map((x)=>x.id),['a','b']);
  assert.deepEqual(flat[1].tokenIds,['2']);
});

test('phrasing splits and recombines leaf units without duplicating Scripture tokens', () => {
  const nodes=[{id:'a',tokenIds:['1','2','3','4'],label:'clause',children:[]}];
  const split=splitPhraseNode(nodes,'a','2','b');
  assert.deepEqual(split.map((x)=>x.tokenIds),[['1','2'],['3','4']]);
  assert.equal(split[0].label,'clause');
  assert.equal(split[1].label,undefined);
  const merged=mergePhraseWithPrevious(split,'b');
  assert.deepEqual(merged.map((x)=>x.tokenIds),[['1','2','3','4']]);
});

test('guide exposes structural headings already present in Scripture data', async () => {
  const repo = new MemorySelahRepository();
  const annotations = new AnnotationService(repo);
  const refs = new BsbPdCrossReferenceProvider('');
  const guide = new PassageGuideService(annotations, refs);
  const scripture={translationId:'BSB',passage:p('Phil 2:5-7'),verses:[
    {ref:p('Phil 2:5').start,tokens:[{id:'1',text:'Let ',language:'en'}],heading:'The Mind of Christ'},
    {ref:p('Phil 2:6').start,tokens:[{id:'2',text:'Who ',language:'en'}]},
    {ref:p('Phil 2:7').start,tokens:[{id:'3',text:'but emptied ',language:'en'}]},
  ]};
  const result=await guide.build(scripture);
  assert.deepEqual(result.sections,[{verse:5,heading:'The Mind of Christ'}]);
  assert.deepEqual(result.backlinks,[]);
});


test('guide derives previous/current/next literary sections from Bible headings', async () => {
  const repo = new MemorySelahRepository();
  const annotations = new AnnotationService(repo);
  const refs = new BsbPdCrossReferenceProvider('');
  const chapter=[
    {ref:p('Phil 2:1').start,tokens:[{id:'a',text:'A',language:'en'}],heading:'Unity and Humility'},
    {ref:p('Phil 2:2').start,tokens:[{id:'b',text:'B',language:'en'}]},
    {ref:p('Phil 2:5').start,tokens:[{id:'c',text:'C',language:'en'}],heading:'The Mind of Christ'},
    {ref:p('Phil 2:6').start,tokens:[{id:'d',text:'D',language:'en'}]},
    {ref:p('Phil 2:12').start,tokens:[{id:'e',text:'E',language:'en'}],heading:'Lights in the World'},
    {ref:p('Phil 2:13').start,tokens:[{id:'f',text:'F',language:'en'}]},
  ];
  const scriptureProvider={translation:{id:'BSB',name:'BSB',abbreviation:'BSB',language:'en',license:'PD'},getChapter:async()=>chapter};
  const guide = new PassageGuideService(annotations, refs, scriptureProvider);
  const scripture={translationId:'BSB',passage:p('Phil 2:5-7'),verses:chapter.slice(2,4)};
  const result=await guide.build(scripture);
  assert.deepEqual(result.literaryContext.map((x)=>[x.role,x.heading]),[
    ['previous','Unity and Humility'],['current','The Mind of Christ'],['next','Lights in the World'],
  ]);
  assert.equal(result.literaryContext[1].passage.start.verse,5);
  assert.equal(result.literaryContext[1].passage.end.verse,11);
});


test('compact chapter research infers source verse from line position', async () => {
  const jsonl=[
    JSON.stringify({x:['JHN.1.1'],m:[{s:'H1',m:'HN',p:'noun',l:'א'}]}),
    JSON.stringify({x:['ROM.1.1'],m:[]}),
  ].join('\n');
  const refs=new BsbPdCrossReferenceProvider(jsonl,{book:'GEN',chapter:1});
  const result=await refs.forPassage(p('Gen 1:2'));
  assert.equal(result.length,1);
  assert.equal(result[0].source.start.verse,2);
  assert.equal(result[0].target.start.book,'ROM');
});


test('structural markers surface explicit discourse signals without treating them as interpretation', () => {
  const scripture={translationId:'BSB',passage:p('Phil 2:5-8'),verses:[
    {ref:p('Phil 2:5').start,tokens:[{id:'a',text:'If ',language:'en'},{id:'b',text:'anything ',language:'en'}]},
    {ref:p('Phil 2:6').start,tokens:[{id:'c',text:'but ',language:'en'},{id:'d',text:'not ',language:'en'}]},
    {ref:p('Phil 2:7').start,tokens:[{id:'e',text:'so that ',language:'en'},{id:'f',text:'others ',language:'en'}]},
    {ref:p('Phil 2:8').start,tokens:[{id:'g',text:'therefore ',language:'en'},{id:'h',text:'God ',language:'en'}]},
  ]};
  const markers=analyzeStructuralMarkers(scripture);
  assert.deepEqual(markers.map((x)=>[x.label,x.category]),[
    ['if','condition'],['but','contrast'],['so that','purpose-result'],['therefore','inference'],
  ]);
});


test('guide enriches important lexical signals with readable lexicon data', async () => {
  const repo = new MemorySelahRepository();
  const annotations = new AnnotationService(repo);
  const refs = new BsbPdCrossReferenceProvider('');
  const lexicon = {
    async get(){ return undefined; },
    async getMany(keys){ return keys.includes('G3444') ? [{ strongs:'G3444', language:'greek', lemma:'μορφή', transliteration:'morphē', gloss:'form' }] : []; },
    async search(){ return []; },
  };
  const guide = new PassageGuideService(annotations, refs, undefined, lexicon);
  const scripture={translationId:'BSB',passage:p('Phil 2:6-7'),verses:[
    {ref:p('Phil 2:6').start,tokens:[{id:'1',text:'form',strongs:'G3444',language:'en'}]},
    {ref:p('Phil 2:7').start,tokens:[{id:'2',text:'form',strongs:'G3444',language:'en'}]},
  ]};
  const result=await guide.build(scripture);
  assert.equal(result.importantLexicalItems[0].strongs,'G3444');
  assert.equal(result.importantLexicalItems[0].count,2);
  assert.equal(result.importantLexicalItems[0].entry.lemma,'μορφή');
});
