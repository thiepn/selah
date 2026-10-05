#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const dataRoot=process.env.SELAH_WEB_OUTPUT??join(root,'.generated/data/web');
const { BOOKS }=await import('../../dist/src/domain/references/books.js');

let chapters=0;
let verses=0;
for(const book of BOOKS){
  for(let chapter=1;chapter<=book.chapters;chapter+=1){
    const path=join(dataRoot,`display/${book.id}/${book.id}${chapter}.json`);
    const payload=JSON.parse(await readFile(path,'utf8'));
    if(payload.book!==book.id||payload.chapter!==chapter||!payload.verses||typeof payload.verses!=='object'){
      throw new Error(`Malformed WEB chapter asset: ${book.id} ${chapter}`);
    }
    const entries=Object.entries(payload.verses);
    if(!entries.length)throw new Error(`Empty WEB chapter: ${book.id} ${chapter}`);
    for(const [verse,text] of entries){
      if(!/^\d+$/.test(verse)||typeof text!=='string'||!text.trim())throw new Error(`Invalid WEB verse: ${book.id} ${chapter}:${verse}`);
      verses+=1;
    }
    chapters+=1;
  }
}
if(chapters!==1189)throw new Error(`Expected 1189 WEB chapters, found ${chapters}`);
if(verses<31_000)throw new Error(`WEB verse count suspiciously low: ${verses}`);
const source=await readFile(join(dataRoot,'SOURCE.md'),'utf8');
if(!/Public Domain/i.test(source)||!/worldenglish\.bible/i.test(source))throw new Error('WEB source/license record is incomplete');
const metadata=JSON.parse(await readFile(join(dataRoot,'SOURCE-METADATA.json'),'utf8'));
if(metadata.name!=='World English Bible'||metadata.stats?.books!==66||metadata.stats?.chapters!==1189||!/public-domain/i.test(metadata.license??''))throw new Error('Vendored WEB metadata does not identify the expected public-domain 66-book edition');
if((await stat(join(dataRoot,'selah-data-manifest.json'))).size<100)throw new Error('WEB data manifest is unexpectedly small');
console.log(`Validated WEB comparison data: ${chapters} chapters / ${verses} verses.`);
