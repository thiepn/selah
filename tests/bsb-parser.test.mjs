import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBsbDisplayJsonl, parseBsbOriginalTokens } from '../dist/src/data/bsb/index.js';

const fixture = [
  JSON.stringify({eng:{1:[["In the beginning","H7225"],["God","H430"],["created","H1254"]]},heb:{1:[["בְּרֵאשִׁית","H7225"],["בָּרָא","H1254"],["אֱלֹהִים","H430"]]},structure:{1:{headings:[{level:'s1',text:'The Creation'}],para:['p']}}}),
  JSON.stringify({eng:{2:[["Now","H1961"],["the earth","H776"]]},heb:{2:[["וְהָאָרֶץ","H776"]]}}),
].join('\n');

test('BSB display parser normalizes chapter JSONL into stable Selah tokens', () => {
  const verses = parseBsbDisplayJsonl(fixture, 'GEN', 1);
  assert.equal(verses.length, 2);
  assert.equal(verses[0].tokens[0].id, 'BSB:GEN.1.1:en:000');
  assert.equal(verses[0].tokens[0].strongs, 'H7225');
  assert.equal(verses[0].heading, 'The Creation');
  assert.equal(verses[0].paragraphStart, true);
});

test('BSB parser exposes original-language tokens separately', () => {
  const original = parseBsbOriginalTokens(fixture, 'GEN', 1);
  assert.equal(original.get(1)[0].language, 'hbo');
  assert.equal(original.get(1)[0].strongs, 'H7225');
});
