import test from 'node:test';
import assert from 'node:assert/strict';
import { AnnotationService } from '../dist/src/annotations/index.js';
import { parseReference } from '../dist/src/domain/references/index.js';
import { MemorySelahRepository } from '../dist/src/persistence/index.js';

const p = (x) => parseReference(x).passage;

test('reference notes are translation independent while text anchors are translation specific', async () => {
  const repo = new MemorySelahRepository();
  const service = new AnnotationService(repo, { idFactory: (() => { let n = 0; return () => `a${++n}`; })(), now: () => 1 });
  await service.createReferenceNote(p('Phil 2:5-11'), 'passage note');
  await service.createTextNote({ translationId:'BSB', verse:p('Phil 2:6').start, startTokenId:'a', endTokenId:'b', quotedText:'form of God', body:'text note' });
  assert.equal((await service.forPassage(p('Phil 2:6'), 'BSB')).length, 2);
  assert.equal((await service.forPassage(p('Phil 2:6'), 'OTHER')).length, 1);
});

test('questions and highlights remain distinct anchored annotation types', async () => {
  const repo = new MemorySelahRepository();
  const service = new AnnotationService(repo, { idFactory: (() => { let n = 0; return () => `x${++n}`; })(), now: () => 2 });
  await service.createQuestion(p('Phil 2:6'), 'What does “form” contribute to the argument?', 's1');
  await service.createHighlight({ translationId:'BSB', verse:p('Phil 2:6').start, startTokenId:'t1', endTokenId:'t2', quotedText:'form of God', studyId:'s1' });
  const all = await repo.listAnnotations('s1');
  assert.deepEqual(all.map((x)=>x.kind).sort(), ['highlight','question']);
});


test('annotations can be edited and removed without changing their anchor', async () => {
  const repo = new MemorySelahRepository();
  const service = new AnnotationService(repo, { idFactory: () => 'edit-1', now: (() => { let n=10; return () => ++n; })() });
  const original = await service.createReferenceNote(p('Rom 8:1'), 'first', 's1');
  const updated = await service.update(original.id, { body:'revised', tags:['justification'] });
  assert.equal(updated.body, 'revised');
  assert.deepEqual(updated.anchor, original.anchor);
  assert.deepEqual(updated.tags, ['justification']);
  await service.remove(original.id);
  assert.equal((await repo.listAnnotations('s1')).length, 0);
});


test('cross-chapter reference annotations remain visible on both sides of the boundary', async () => {
  const repo = new MemorySelahRepository();
  const service = new AnnotationService(repo, { idFactory:()=> 'cross-1', now:()=> 5 });
  await service.createReferenceNote(p('Rom 8:39-9:1'), 'crosses the chapter boundary');
  assert.equal((await service.forPassage(p('Rom 8:39'), 'BSB')).length,1);
  assert.equal((await service.forPassage(p('Rom 9:1'), 'BSB')).length,1);
});


test('multi-verse text anchors preserve exact selection and translation scope', async () => {
  const repo = new MemorySelahRepository();
  const ids=(()=>{let n=0;return()=>`range-${++n}`;})();
  const service = new AnnotationService(repo,{idFactory:ids,now:()=>7});
  const passage=p('Rom 8:39-9:1');
  const note=await service.createRangeTextNote({
    translationId:'BSB',passage,startTokenId:'BSB:ROM.8.39:en:003',endTokenId:'BSB:ROM.9.1:en:004',
    quotedText:'nor anything else ... I am speaking the truth',body:'cross-chapter observation',studyId:'s1'
  });
  const highlight=await service.createRangeHighlight({
    translationId:'BSB',passage,startTokenId:'BSB:ROM.8.39:en:003',endTokenId:'BSB:ROM.9.1:en:004',
    quotedText:'nor anything else ... I am speaking the truth',studyId:'s1'
  });
  assert.equal(note.anchor.type,'text-range');
  assert.equal(highlight.anchor.type,'text-range');
  assert.equal((await service.forPassage(p('Rom 9:1'),'BSB','s1')).length,2);
  assert.equal((await service.forPassage(p('Rom 9:1'),'OTHER','s1')).length,0);
});


test('questions preserve prompt and response as separate durable fields',async()=>{
  const repo=new MemorySelahRepository();
  const service=new AnnotationService(repo,{idFactory:()=> 'q1',now:(()=>{let n=20;return()=>++n;})()});
  const question=await service.createQuestion(p('Phil 2:5-11'),'How does Christ ground Paul\'s appeal?','s1');
  const answered=await service.update(question.id,{response:'Paul points to Christ\'s self-humbling obedience as the pattern for the church.'});
  assert.equal(answered.body,question.body);
  assert.match(answered.response,/self-humbling obedience/);
  assert.deepEqual(answered.anchor,question.anchor);
});
