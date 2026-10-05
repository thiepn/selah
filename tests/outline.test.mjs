import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReference } from '../dist/src/domain/references/index.js';
import { MemorySelahRepository } from '../dist/src/persistence/index.js';
import { OutlineService, normalizeOutlineSections } from '../dist/src/study/outline/index.js';

const p=(value)=>parseReference(value).passage;
const study={id:'s1',primaryPassage:p('Phil 2:5-11'),tags:[],archived:false,createdAt:1,updatedAt:1};

test('outline normalization orders sections and keeps them inside the study passage',()=>{
  const sections=normalizeOutlineSections(study,[
    {id:'b',passage:p('Phil 2:9-11'),label:'  God exalts Christ  '},
    {id:'a',passage:p('Phil 2:5-8'),label:'Christ humbles himself'},
  ]);
  assert.deepEqual(sections.map((x)=>x.id),['a','b']);
  assert.equal(sections[1].label,'God exalts Christ');
});

test('outline rejects overlapping and out-of-range sections',()=>{
  assert.throws(()=>normalizeOutlineSections(study,[
    {id:'a',passage:p('Phil 2:5-8'),label:'A'},
    {id:'b',passage:p('Phil 2:8-11'),label:'B'},
  ]),/cannot overlap/);
  assert.throws(()=>normalizeOutlineSections(study,[
    {id:'a',passage:p('Phil 2:4-6'),label:'A'},
  ]),/inside the study passage/);
});

test('outline service persists normalized passage structure',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  await repo.putStudy(study);
  const service=new OutlineService(repo);
  const saved=await service.save(study,[
    {id:'a',passage:p('Phil 2:5-8'),label:'Humiliation'},
    {id:'b',passage:p('Phil 2:9-11'),label:'Exaltation'},
  ],99);
  assert.equal(saved.updatedAt,99);
  assert.deepEqual(await repo.getStudyOutline('s1'),saved);
});
