import test from 'node:test';
import assert from 'node:assert/strict';
import { ScriptureSearchIndex } from '../dist/src/search/index.js';

const verse = (v, words) => ({ref:{book:'PHP',chapter:2,verse:v},tokens:words.map((text,i)=>({id:`x${i}`,text,language:'en'}))});

test('scripture index ranks exact phrase matches and requires all query terms', () => {
  const index = new ScriptureSearchIndex();
  index.add(verse(5,['Let','this','mind','be','in','you']));
  index.add(verse(6,['existing','in','the','form','of','God']));
  index.add(verse(7,['taking','the','form','of','a','servant']));
  const result = index.search('form God');
  assert.equal(result.length, 1);
  assert.equal(result[0].canonicalId, 'Phil.2.6');
});
