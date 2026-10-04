import { readFile } from 'node:fs/promises';

const url = new URL('../../data/manifests/sources.json', import.meta.url);
const parsed = JSON.parse(await readFile(url, 'utf8'));
if (parsed.schemaVersion !== 1) throw new Error('Unsupported source manifest schemaVersion');
if (!Array.isArray(parsed.sources) || parsed.sources.length === 0) throw new Error('No data sources declared');
const ids = new Set();
for (const source of parsed.sources) {
  for (const key of ['id','name','category','sourceUrl','license']) {
    if (!source[key]) throw new Error(`Source missing ${key}: ${JSON.stringify(source)}`);
  }
  if (ids.has(source.id)) throw new Error(`Duplicate source id: ${source.id}`);
  ids.add(source.id);
  new URL(source.sourceUrl);
  if (source.attributionRequired && !source.attribution) {
    throw new Error(`Attribution required but missing for ${source.id}`);
  }
}
console.log(`Validated ${parsed.sources.length} data-source manifest entries.`);
