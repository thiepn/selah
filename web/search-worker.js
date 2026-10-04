import { ScriptureSearchIndex } from './core/search/index.js';

let indexPromise;

async function loadIndex() {
  indexPromise ??= fetch('./data/selah/scripture-search.json')
    .then(async (response) => {
      if (!response.ok) throw new Error('Scripture search index is not installed');
      return ScriptureSearchIndex.fromSerialized(await response.json());
    });
  return indexPromise;
}

self.addEventListener('message', async (event) => {
  const { id, query, limit = 30 } = event.data ?? {};
  if (typeof id !== 'number' || typeof query !== 'string') return;
  try {
    const index = await loadIndex();
    self.postMessage({ id, results: index.search(query, limit) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
