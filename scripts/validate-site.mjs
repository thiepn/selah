import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const site=join(root,'site');
for(const file of ['index.html','app.js','search-worker.js','styles.css','sw.js','manifest.webmanifest','core/domain/references/index.js','core/persistence/index.js']) await access(join(site,file));
try { await access(join(site,'data/bsb/display/PHP/PHP2.json')); } catch { await access(join(site,'data/bsb/display/PHP/PHP2.jsonl')); }
const html=await readFile(join(site,'index.html'),'utf8');
const app=await readFile(join(site,'app.js'),'utf8');
const searchWorker=await readFile(join(site,'search-worker.js'),'utf8');
if(/\bToday\b|dashboard|streak/i.test(html)) throw new Error('Study UI regressed toward dashboard/productivity concepts');
if(/development fixture|vendoring command/i.test(app)) throw new Error('Developer-only data language leaked into the study UI');
if(/id="referenceInput"[^>]+value="[^"]+"/.test(html)||!app.includes('renderPassageLauncher')) throw new Error('First launch regressed to a hard-coded sample passage');
if(!html.includes('id="scripture"')||!html.includes('data-tab="guide"')) throw new Error('Core study workspace missing');
if(!app.includes('IndexedDbSelahRepository')||!app.includes('PassageGuideService')) throw new Error('Web UI is not wired to Selah core services');
if(!app.includes("new Worker('./search-worker.js'")||!searchWorker.includes('ScriptureSearchIndex')) throw new Error('Scripture search worker is not wired into the deployable study workspace');
if(app.includes("const tokenEls = $('.token');")) throw new Error('Highlight renderer regressed to a single-element token selector');
if(/(?<!\\$)\\$\\([^\\n;]*\\)\\.(?:forEach|map|filter|findIndex|indexOf|some|every|reduce|slice|at)\\b/.test(app)) throw new Error('A single-element DOM helper is used with an array method');
console.log('Static site integrity checks passed.');
