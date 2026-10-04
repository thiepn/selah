#!/usr/bin/env node
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { parseBsbUsjDocument } from '../../dist/src/data/bsb/usj.js';
import { BOOKS } from '../../dist/src/domain/references/books.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const dataRoot=process.env.SELAH_BSB_OUTPUT??join(root,'.generated/data/bsb');
const cacheRoot=join(root,'.cache/bsb-canonical');
const zipPath=join(cacheRoot,'BSB_usj.zip');
const extractRoot=join(cacheRoot,'usj');
const usjUrl=process.env.SELAH_BSB_USJ_URL??'https://github.com/BSB-publishing/bsb2usfm/releases/latest/download/BSB_usj.zip';

const run=(command,args)=>new Promise((resolve,reject)=>{
  const child=spawn(command,args,{stdio:'inherit'});
  child.on('exit',(code)=>code===0?resolve():reject(new Error(`${command} exited with ${code}`)));
  child.on('error',reject);
});

async function download(url,target){
  const response=await fetch(url,{redirect:'follow',headers:{'user-agent':'Selah-canonical-BSB/1.0'}});
  if(!response.ok)throw new Error(`Failed to download official BSB USJ: ${response.status} ${response.statusText}`);
  await writeFile(target,Buffer.from(await response.arrayBuffer()));
}

async function extract(zip,target){
  await rm(target,{recursive:true,force:true});
  await mkdir(target,{recursive:true});
  try{await run('unzip',['-q','-o',zip,'-d',target]);}
  catch{await run('python3',['-m','zipfile','-e',zip,target]);}
}

async function findUsj(dir){
  const output=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,entry.name);
    if(entry.isDirectory())output.push(...await findUsj(path));
    else if(entry.isFile()&&entry.name.toLowerCase().endsWith('.usj'))output.push(path);
  }
  return output;
}

const normalize=(value)=>value
  .normalize('NFKC')
  .replace(/[\u200B-\u200D\uFEFF]/g,'')
  .replace(/[“”]/g,'"').replace(/[‘’]/g,"'")
  .replace(/[–—]/g,'-')
  .replace(/\s+/g,' ')
  .replace(/\s+([,.;:!?])/g,'$1')
  .trim();

const joinedEnglish=(tokens)=>tokens.map((token)=>String(token?.[0]??'')).join('');

await rm(cacheRoot,{recursive:true,force:true});
await mkdir(cacheRoot,{recursive:true});
console.log(`Downloading canonical BSB USJ from ${usjUrl}`);
await download(usjUrl,zipPath);
await extract(zipPath,extractRoot);

const usjFiles=await findUsj(extractRoot);
if(usjFiles.length<66)throw new Error(`Expected at least 66 BSB USJ files, found ${usjFiles.length}`);

const canonical=new Map();
for(const path of usjFiles){
  const parsed=parseBsbUsjDocument(await readFile(path,'utf8'));
  if(canonical.has(parsed.book))throw new Error(`Duplicate official USJ book: ${parsed.book}`);
  canonical.set(parsed.book,parsed);
}
for(const book of BOOKS)if(!canonical.has(book.id))throw new Error(`Official USJ missing book ${book.id}`);

let canonicalVerses=0;
let alignedVerses=0;
let fallbackVerses=0;
let missingDerivedVerses=0;
let mismatchedDerivedVerses=0;
const maxVerses={};
const mismatchSamples=[];

for(const book of BOOKS){
  const official=canonical.get(book.id);
  maxVerses[book.id]={};
  for(let chapter=1;chapter<=book.chapters;chapter+=1){
    const officialChapter=official.chapters[chapter];
    if(!officialChapter)throw new Error(`Official USJ missing ${book.id} ${chapter}`);

    const displayPath=join(dataRoot,`display/${book.id}/${book.id}${chapter}.json`);
    const display=JSON.parse(await readFile(displayPath,'utf8'));
    const originalKeys=Object.keys(display.eng??{}).map(Number).sort((a,b)=>a-b);

    const mapPath=join(dataRoot,`research-verse-map/${book.id}/${book.id}${chapter}.json`);
    await mkdir(dirname(mapPath),{recursive:true});
    await writeFile(mapPath,JSON.stringify(originalKeys));

    const eng={};
    const structure={};
    const verseNumbers=Object.keys(officialChapter).map(Number).sort((a,b)=>a-b);
    if(!verseNumbers.length)throw new Error(`Official USJ has no verses for ${book.id} ${chapter}`);
    maxVerses[book.id][chapter]=Math.max(...verseNumbers);

    for(const verse of verseNumbers){
      canonicalVerses+=1;
      const officialVerse=officialChapter[verse];
      if(!officialVerse.text)throw new Error(`Official USJ has empty text at ${book.id}.${chapter}.${verse}`);
      const existing=display.eng?.[String(verse)];
      if(existing&&normalize(joinedEnglish(existing))===normalize(officialVerse.text)){
        eng[String(verse)]=existing;
        alignedVerses+=1;
      }else{
        eng[String(verse)]=[[officialVerse.text,null,{canonicalFallback:true}]];
        fallbackVerses+=1;
        if(!existing)missingDerivedVerses+=1;
        else{
          mismatchedDerivedVerses+=1;
          if(mismatchSamples.length<20)mismatchSamples.push({
            ref:`${book.id}.${chapter}.${verse}`,
            official:officialVerse.text,
            derived:joinedEnglish(existing),
          });
        }
      }
      if(officialVerse.headings.length||officialVerse.para.length){
        structure[String(verse)]={};
        if(officialVerse.headings.length)structure[String(verse)].headings=officialVerse.headings;
        if(officialVerse.para.length)structure[String(verse)].para=officialVerse.para;
      }
    }

    // English is canonical USJ. Original-language arrays remain research aids;
    // absent alignment is preferable to shifting an original token onto the
    // wrong English verse.
    await writeFile(displayPath,JSON.stringify({...display,eng,structure}));
  }
}

const expectedVersification=JSON.parse(await readFile(join(dataRoot,'versification/eng.json'),'utf8'));
let expectedNumberedSlots=0;
for(const book of BOOKS){
  const chapterMaxima=expectedVersification.max_verses?.[book.id];
  if(!Array.isArray(chapterMaxima)||chapterMaxima.length!==book.chapters){
    throw new Error(`English versification chapter metadata is incomplete for ${book.id}`);
  }
  for(let chapter=1;chapter<=book.chapters;chapter+=1){
    const expectedMax=Number(chapterMaxima[chapter-1]);
    const officialMax=Number(maxVerses[book.id][chapter]);
    if(officialMax!==expectedMax){
      throw new Error(`Official BSB USJ max verse ${book.id} ${chapter}:${officialMax} does not match English versification max ${expectedMax}`);
    }
    expectedNumberedSlots+=expectedMax;
  }
}
const omittedVerseNumbers=expectedNumberedSlots-canonicalVerses;
if(omittedVerseNumbers<0)throw new Error(`Official BSB USJ has more verse records (${canonicalVerses}) than numbered English versification slots (${expectedNumberedSlots})`);

await writeFile(join(dataRoot,'max-verses.json'),JSON.stringify(maxVerses));
await writeFile(join(dataRoot,'canonicalization-report.json'),JSON.stringify({
  source:usjUrl,
  canonicalVerses,
  expectedNumberedSlots,
  omittedVerseNumbers,
  alignedVerses,
  fallbackVerses,
  missingDerivedVerses,
  mismatchedDerivedVerses,
  mismatchSamples,
},null,2));

await rm(cacheRoot,{recursive:true,force:true});
console.log(`Canonicalized ${canonicalVerses} BSB verses: ${alignedVerses} retained aligned tokens, ${fallbackVerses} canonical fallbacks (${missingDerivedVerses} missing derived, ${mismatchedDerivedVerses} mismatched).`);
