import test from 'node:test';
import assert from 'node:assert/strict';
import { BsbReverseCrossReferenceProvider } from '../dist/src/research/cross-references/index.js';
import { parseReference } from '../dist/src/domain/references/index.js';

const p=(x)=>parseReference(x).passage;

test('reverse cross-reference provider exposes passages that point to the current text', async()=>{
  const provider=new BsbReverseCrossReferenceProvider({
    version:1,
    incoming:{'PHP.2.6':['JHN.1.14','COL.1.15'],'ISA.45.23':['PHP.2.10']},
  });
  const refs=await provider.backlinksForPassage(p('Phil 2:6'));
  assert.equal(refs.length,2);
  assert.equal(refs[0].target.start.book,'PHP');
  assert.deepEqual(refs.map((x)=>x.source.start.book).sort(),['COL','JHN']);
});

test('reverse cross-reference provider filters a passage range without changing edge direction', async()=>{
  const provider=new BsbReverseCrossReferenceProvider({
    version:1,
    incoming:{'PHP.2.6':['JHN.1.14'],'PHP.2.7':['2CO.8.9'],'PHP.2.10':['ISA.45.23']},
  });
  const refs=await provider.backlinksForPassage(p('Phil 2:6-7'));
  assert.equal(refs.length,2);
  assert.equal(refs[0].sourceDataset,'bsb-crossref-reverse');
  assert.ok(refs.every((x)=>x.target.start.verse>=6&&x.target.start.verse<=7));
});
