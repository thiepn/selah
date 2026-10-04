import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const site=join(root,'site');
for(const file of ['index.html','app.js','styles.css','sw.js','manifest.webmanifest','core/domain/references/index.js','core/persistence/index.js']) await access(join(site,file));
try { await access(join(site,'data/bsb/display/PHP/PHP2.json')); } catch { await access(join(site,'data/bsb/display/PHP/PHP2.jsonl')); }
const html=await readFile(join(site,'index.html'),'utf8');
const app=await readFile(join(site,'app.js'),'utf8');
if(/\bToday\b|dashboard|streak/i.test(html)) throw new Error('Study UI regressed toward dashboard/productivity concepts');
if(!html.includes('id="scripture"')||!html.includes('data-tab="guide"')) throw new Error('Core study workspace missing');
if(!app.includes('IndexedDbSelahRepository')||!app.includes('PassageGuideService')) throw new Error('Web UI is not wired to Selah core services');
console.log('Static site integrity checks passed.');
