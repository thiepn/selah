import test from 'node:test';
import assert from 'node:assert/strict';
import { PassageContextStore } from '../dist/src/domain/context/index.js';
import { parseReference } from '../dist/src/domain/references/index.js';

const passage = parseReference('Phil 2:5-11').passage;

test('passage context broadcasts coherent updates', () => {
  const store = new PassageContextStore({ primaryPassage: passage, translationId: 'BSB' });
  const events = [];
  const unsubscribe = store.subscribe((current, previous) => events.push(`${previous.translationId}->${current.translationId}`));
  store.patch({ translationId: 'DEMO' });
  unsubscribe();
  store.patch({ translationId: 'IGNORED' });
  assert.deepEqual(events, ['BSB->DEMO']);
});

test('clearSelection removes active verse and text selection without changing passage', () => {
  const store = new PassageContextStore({
    primaryPassage: passage,
    translationId: 'BSB',
    activeVerse: passage.start,
    selection: { range: passage, text: 'test', tokenIds: ['x'] },
  });
  store.clearSelection();
  assert.equal(store.get().activeVerse, undefined);
  assert.equal(store.get().selection, undefined);
  assert.deepEqual(store.get().primaryPassage, passage);
});
