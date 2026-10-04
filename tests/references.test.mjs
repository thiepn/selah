import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalPassageId, formatPassage, parseReference } from '../dist/src/domain/references/index.js';

test('parses common chapter aliases', () => {
  assert.deepEqual(parseReference('Phil 2'), { kind: 'chapter', book: 'PHP', chapter: 2 });
  assert.deepEqual(parseReference('Romans 8'), { kind: 'chapter', book: 'ROM', chapter: 8 });
  assert.deepEqual(parseReference('1 John 3'), { kind: 'chapter', book: '1JN', chapter: 3 });
});

test('parses verse and range references', () => {
  const parsed = parseReference('Phil 2:5-11');
  assert.equal(parsed.kind, 'passage');
  assert.equal(canonicalPassageId(parsed.passage), 'Phil.2.5-Phil.2.11');
  assert.equal(formatPassage(parsed.passage), 'Philippians 2:5–11');
});

test('parses cross-chapter ranges', () => {
  const parsed = parseReference('John 3:36-4:2');
  assert.equal(canonicalPassageId(parsed.passage), 'John.3.36-John.4.2');
});

test('handles one-chapter book references', () => {
  const parsed = parseReference('Jude 1:3-5');
  assert.equal(canonicalPassageId(parsed.passage), 'Jude.1.3-Jude.1.5');
});

test('rejects backwards and malformed references', () => {
  assert.throws(() => parseReference('Phil 2:11-5'));
  assert.throws(() => parseReference('NotABook 2:1'));
  assert.throws(() => parseReference('Phil 9:1'));
});
