#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root=fileURLToPath(new URL('../../',import.meta.url));
const outputRoot=process.env.SELAH_BSB_OUTPUT??join(root,'.generated/data/bsb');
const cache=join(root,'.cache/bsb-data-output');
const repo=process.env.SELAH_BSB_GIT_URL??'https://github.com/BSB-publishing/bsb-data-output.git';
const { BOOKS }=await import('../../dist/src/domain/references/books.js');

const run=(command,args)=>new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:'inherit'});child.on('exit',(code)=>code===0?resolve():reject(new Error(`${command} exited with ${code}`)));child.on('error',reject);});

await rm(cache,{recursive:true,force:true});
await mkdir(join(root,'.cache'),{recursive:true});
await run('git',['clone','--depth','1','--filter=blob:none',repo,cache]);
await rm(outputRoot,{recursive:true,force:true});
await mkdir(outputRoot,{recursive:true});

for(const path of ['base/display','base/index-cc-by','base/concordance','base/lexicon','base/versification']) await cp(join(cache,path),join(outputRoot,path.replace(/^base\//,'')),{recursive:true});
for(const file of ['VERSION.json','ATTRIBUTION.md','LICENSE-CC0.md','LICENSE-CC-BY.md']) await cp(join(cache,file),join(outputRoot,file));

const maxVerses={}; let verses=0; let bytes=0; let chapters=0;
for(const book of BOOKS){
  maxVerses[book.id]={};
  for(let chapter=1;chapter<=book.chapters;chapter+=1){
    chapters+=1;
    const path=join(outputRoot,`display/${book.id}/${book.id}${chapter}.json`);
    const text=await readFile(path,'utf8'); bytes+=Buffer.byteLength(text); let max=0;
    const parsed=JSON.parse(text); for(const key of Object.keys(parsed.eng??{})){max=Math.max(max,Number(key));verses+=1;}
    maxVerses[book.id][chapter]=max;
  }
}
await writeFile(join(outputRoot,'max-verses.json'),JSON.stringify(maxVerses));
await writeFile(join(outputRoot,'selah-data-manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),source:repo,assets:chapters*2+4,chapters,verses,displayBytes:bytes,licenses:{display:'CC0',concordance:'CC0',indexCcBy:'CC-BY-4.0',lexicon:'CC-BY-4.0'}},null,2));
await rm(cache,{recursive:true,force:true});
console.log(`Vendored full BSB research dataset (${verses} verses).`);
