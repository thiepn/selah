import { readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const site=join(root,'site');
async function size(file){return (await stat(file)).size;}
async function jsBytes(dir){let total=0;for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())total+=await jsBytes(path);else if(extname(entry.name)==='.js')total+=await size(path);}return total;}
const app=await size(join(site,'app.js'));
const css=await size(join(site,'styles.css'));
const uiModules=(await size(join(site,'book-overview.js')))+(await size(join(site,'guide-literary-mode.js')))+(await size(join(site,'interpretation-claims.js')))+(await size(join(site,'search-workspace.js')))+(await size(join(site,'a11y-overlays.js')))+(await size(join(site,'translation-compare.js')))+(await size(join(site,'personal-reference-ui.js')));
const core=await jsBytes(join(site,'core'));
const budgets={app:100_000,uiModules:20_000,css:80_000,core:250_000};
const values={app,uiModules,css,core};
for(const [key,value] of Object.entries(values)){if(value>budgets[key])throw new Error(`${key} bundle ${value} bytes exceeds budget ${budgets[key]}`);}
console.log(`Bundle budgets passed: app ${app} B, UI modules ${uiModules} B, CSS ${css} B, core JS ${core} B.`);
