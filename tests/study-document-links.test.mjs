import test from 'node:test';
import assert from 'node:assert/strict';
import { extractStudyDocumentScriptureLinks } from '../dist/src/domain/studies/index.js';

test('Study Documents extract valid Scripture wiki links without interpreting ordinary text', () => {
  const text = 'Compare [[Romans 8:1-4]] with [[Phil 2:5–11]]. Keep [[not a reference]] and [[study:Romans 8]] as ordinary text.';
  const links = extractStudyDocumentScriptureLinks(text);
  assert.deepEqual(links.map((x)=>x.label), ['Romans 8:1-4','Phil 2:5–11']);
  assert.deepEqual(links[0].passage, {start:{book:'ROM',chapter:8,verse:1},end:{book:'ROM',chapter:8,verse:4}});
  assert.equal(text.slice(links[1].start,links[1].end), '[[Phil 2:5–11]]');
});
