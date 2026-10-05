#!/usr/bin/env node
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root=fileURLToPath(new URL('../../',import.meta.url));
const outputRoot=process.env.SELAH_WEB_OUTPUT??join(root,'.generated/data/web');
const cache=join(root,'.cache/web-bible-data');
const repo=process.env.SELAH_WEB_GIT_URL??'https://github.com/midvash/bible-data.git';
const { BOOKS }=await import('../../dist/src/domain/references/books.js');

const run=(command,args)=>new Promise((resolve,reject)=>{
  const child=spawn(command,args,{stdio:'inherit'});
  child.on('exit',(code)=>code===0?resolve():reject(new Error(`${command} exited with ${code}`)));
  child.on('error',reject);
});

await rm(cache,{recursive:true,force:true});
await mkdir(join(root,'.cache'),{recursive:true});
await run('git',['clone','--depth','1','--filter=blob:none','--sparse',repo,cache]);
await run('git',['-C',cache,'sparse-checkout','set','versions/en/web']);

await rm(outputRoot,{recursive:true,force:true});
await mkdir(join(outputRoot,'display'),{recursive:true});

let chapters=0;
let verses=0;
let displayBytes=0;
for(const book of BOOKS){
  const sourcePath=join(cache,'versions/en/web/books',`${book.osis}.json`);
  const source=JSON.parse(await readFile(sourcePath,'utf8'));
  if(!Array.isArray(source.chapters))throw new Error(`WEB source missing chapters: ${book.osis}`);
  if(source.chapters.length!==book.chapters)throw new Error(`WEB chapter-count mismatch for ${book.osis}: ${source.chapters.length} != ${book.chapters}`);
  const byChapter=new Map(source.chapters.map((chapter)=>[Number(chapter.chapter),chapter]));
  const bookOut=join(outputRoot,'display',book.id);
  await mkdir(bookOut,{recursive:true});
  for(let chapter=1;chapter<=book.chapters;chapter+=1){
    const sourceChapter=byChapter.get(chapter);
    if(!sourceChapter||!Array.isArray(sourceChapter.verses))throw new Error(`WEB source missing ${book.osis} ${chapter}`);
    const verseMap={};
    for(const verse of sourceChapter.verses){
      const number=Number(verse.number);
      if(!Number.isInteger(number)||number<1||typeof verse.text!=='string'||!verse.text.length){
        throw new Error(`Invalid WEB verse in ${book.osis} ${chapter}`);
      }
      if(String(number) in verseMap)throw new Error(`Duplicate WEB verse ${book.osis} ${chapter}:${number}`);
      verseMap[number]=verse.text;
      verses+=1;
    }
    const payload=JSON.stringify({book:book.id,chapter,verses:verseMap});
    await writeFile(join(bookOut,`${book.id}${chapter}.json`),payload);
    displayBytes+=Buffer.byteLength(payload);
    chapters+=1;
  }
}

const metadata=JSON.parse(await readFile(join(cache,'versions/en/web/metadata.json'),'utf8'));
await writeFile(join(outputRoot,'SOURCE-METADATA.json'),JSON.stringify(metadata,null,2));
await writeFile(join(outputRoot,'SOURCE.md'),[
  '# World English Bible source',
  '',
  'Translation upstream: https://worldenglish.bible/',
  `Transport mirror: ${repo}`,
  'License: Public Domain',
  '',
  'Selah preserves the supplied verse text and only normalizes storage into per-chapter JSON.',
  ''
].join('\n'));
await writeFile(join(outputRoot,'selah-data-manifest.json'),JSON.stringify({
  generatedAt:new Date().toISOString(),
  source:repo,
  upstream:'https://worldenglish.bible/',
  translation:'WEB',
  license:'Public Domain',
  chapters,
  verses,
  displayBytes,
},null,2));
await rm(cache,{recursive:true,force:true});
console.log(`Vendored WEB comparison dataset (${chapters} chapters / ${verses} verses).`);
