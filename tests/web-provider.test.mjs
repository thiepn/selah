import test from 'node:test';
import assert from 'node:assert/strict';
import { WebScriptureProvider, parseWebChapter } from '../dist/src/data/web/index.js';
import { parseReference } from '../dist/src/domain/references/index.js';

const asset=JSON.stringify({book:'PHP',chapter:2,verses:{
  5:'Have this in your mind, which was also in Christ Jesus,',
  6:'who, existing in the form of God, didn’t consider equality with God a thing to be grasped,',
  7:'but emptied himself, taking the form of a servant, being made in the likeness of men.'
}});
class Loader{async load(path){assert.equal(path,'display/PHP/PHP2.json');return asset;}}

test('WEB chapter parser preserves exact verse text in stable display tokens',()=>{
  const verses=parseWebChapter(asset,'PHP',2);
  assert.equal(verses.length,3);
  assert.equal(verses[1].tokens[0].text,'who, existing in the form of God, didn’t consider equality with God a thing to be grasped,');
  assert.equal(verses[1].tokens[0].id,'WEB:PHP.2.6:0');
});

test('WEB provider serves local passages and reports public-domain metadata',async()=>{
  const provider=new WebScriptureProvider(new Loader());
  const passage=parseReference('Phil 2:5-7').passage;
  assert.equal(provider.translation.id,'WEB');
  assert.match(provider.translation.license,/Public Domain/);
  assert.equal(await provider.hasPassage(passage),true);
  const result=await provider.getPassage(passage);
  assert.equal(result.translationId,'WEB');
  assert.deepEqual(result.verses.map((verse)=>verse.ref.verse),[5,6,7]);
  assert.match(result.verses[2].tokens[0].text,/emptied himself/);
});

test('WEB provider rejects malformed chapter assets',()=>{
  assert.throws(()=>parseWebChapter('{"book":"PHP","chapter":3,"verses":{}}','PHP',2),/Invalid WEB chapter asset/);
});
