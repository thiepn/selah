import { readFile } from 'node:fs/promises';

const source = JSON.parse(
  await readFile('platform/bible-family.json', 'utf8'),
);
const published = JSON.parse(
  await readFile('web/.well-known/bible-product.json', 'utf8'),
);

const failures = [];
const expected = ['study', 'devotion', 'tms60', 'greek'];
const modules = new Map(source.modules.map((module) => [module.id, module]));

if (JSON.stringify(source) !== JSON.stringify(published))
  failures.push('Published Bible contract must match the source contract.');
if (source.schemaVersion !== 1 || source.phase !== 'P10')
  failures.push('Bible family contract must be schema v1 / P10.');
if (source.product !== 'bible' || source.defaultModule !== 'study')
  failures.push('Bible family identity/default module drifted.');
if (source.registryState !== 'staged')
  failures.push('Bible family must remain staged until one public family surface exists.');
if (source.shell?.repo !== 'thiepn/selah')
  failures.push('Selah must remain the study/future-home provider.');
if (source.shell?.mayProxyExternalWrites !== false)
  failures.push('Bible shell must not proxy provider writes in P10.');
if (JSON.stringify(source.modules.map((m) => m.id)) !== JSON.stringify(expected))
  failures.push('Bible module set/order drifted.');

for (const id of expected) {
  const module = modules.get(id);
  if (!module) continue;
  if (module.canonicalRef !== `bible/${id}`)
    failures.push(`${id}: canonicalRef mismatch.`);
  if (module.writePolicy !== 'provider-only')
    failures.push(`${id}: writes must remain provider-owned.`);
}

if (modules.get('study')?.provider?.repo !== 'thiepn/selah')
  failures.push('Study provider must be thiepn/selah.');
if (modules.get('devotion')?.provider?.repo !== 'thiepn/my-daily-devotion')
  failures.push('Devotion provider must be thiepn/my-daily-devotion.');
if (modules.get('devotion')?.registryState !== 'staged')
  failures.push('Devotion remains staged without a canonical public launch URL.');
if (modules.get('tms60')?.provider?.launchUrl !== 'https://tms60.thiepn.dev/')
  failures.push('TMS60 production URL changed.');
if (modules.get('greek')?.provider?.launchUrl !== 'https://thiepn.dev/greek/')
  failures.push('Greek production URL changed.');
if (source.sharedScriptureRule?.sharedStorage !== false)
  failures.push('P10 must not introduce a shared Bible database.');
if (source.sharedScriptureRule?.copyProviderRecords !== false)
  failures.push('P10 must not copy provider records between Bible modules.');

if (failures.length) {
  console.error('Platform P10 Bible family validation failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Platform P10 Bible family valid: ${source.modules.length} modules / provider-owned writes preserved.`,
);
