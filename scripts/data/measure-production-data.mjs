#!/usr/bin/env node
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const bsbRoot=process.env.SELAH_BSB_OUTPUT??join(root,'.generated/data/bsb');
const searchPath=join(root,'.generated/data/selah/scripture-search.json');
const siteRoot=join(root,'site');

async function sizeOf(path){
  const info=await stat(path);
  if(!info.isDirectory())return info.size;
  let total=0;
  for(const entry of await readdir(path,{withFileTypes:true})){
    total+=await sizeOf(join(path,entry.name));
  }
  return total;
}

async function countFiles(path){
  const info=await stat(path);
  if(!info.isDirectory())return 1;
  let total=0;
  for(const entry of await readdir(path,{withFileTypes:true})) total+=await countFiles(join(path,entry.name));
  return total;
}

const mib=(bytes)=>bytes/(1024*1024);
const metrics={
  bsbBytes:await sizeOf(bsbRoot),
  bsbFiles:await countFiles(bsbRoot),
  searchBytes:await sizeOf(searchPath),
  reverseCrossrefBytes:await sizeOf(join(bsbRoot,'crossrefs/reverse.json')),
  concordanceBytes:await sizeOf(join(bsbRoot,'concordance/strongs-to-verses.json')),
  siteBytes:await sizeOf(siteRoot),
  siteFiles:await countFiles(siteRoot),
};

const budgets={
  bsbBytes:Number(process.env.SELAH_BUDGET_BSB_BYTES??350*1024*1024),
  searchBytes:Number(process.env.SELAH_BUDGET_SEARCH_BYTES??40*1024*1024),
  reverseCrossrefBytes:Number(process.env.SELAH_BUDGET_REVERSE_CROSSREF_BYTES??50*1024*1024),
  concordanceBytes:Number(process.env.SELAH_BUDGET_CONCORDANCE_BYTES??25*1024*1024),
  siteBytes:Number(process.env.SELAH_BUDGET_SITE_BYTES??450*1024*1024),
};

for(const [key,budget] of Object.entries(budgets)){
  if(metrics[key]>budget)throw new Error(`${key} ${mib(metrics[key]).toFixed(2)} MiB exceeds budget ${mib(budget).toFixed(2)} MiB`);
}

console.log('Production data size qualification passed:');
console.log(`  BSB research pack: ${mib(metrics.bsbBytes).toFixed(2)} MiB across ${metrics.bsbFiles} files`);
console.log(`  Scripture search: ${mib(metrics.searchBytes).toFixed(2)} MiB`);
console.log(`  Reverse references: ${mib(metrics.reverseCrossrefBytes).toFixed(2)} MiB`);
console.log(`  Strong's concordance: ${mib(metrics.concordanceBytes).toFixed(2)} MiB`);
console.log(`  Final static site: ${mib(metrics.siteBytes).toFixed(2)} MiB across ${metrics.siteFiles} files`);
