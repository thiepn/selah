import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS } from '../../dist/src/domain/references/books.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const dataRoot=process.env.SELAH_BSB_OUTPUT??join(root,'.generated/data/bsb');
const output=join(dataRoot,'crossrefs/reverse.json');
const incoming=new Map();
let outgoingEdges=0;

for(const book of BOOKS){
  for(let chapter=1;chapter<=book.chapters;chapter+=1){
    const text=await readFile(join(dataRoot,`index-cc-by/${book.id}/${book.id}${chapter}.jsonl`),'utf8');
    const lines=text.split(/\r?\n/).map((x)=>x.trim()).filter(Boolean);
    const verseMapPath=join(dataRoot,`research-verse-map/${book.id}/${book.id}${chapter}.json`);
    let verseNumbers=[]; try{verseNumbers=JSON.parse(await readFile(verseMapPath,'utf8'));}catch{}
    lines.forEach((raw,index)=>{
      const line=JSON.parse(raw);
      const mappedVerse=Number.isInteger(verseNumbers[index])?verseNumbers[index]:index+1;
      const source=line.id??(line.b&&line.c&&line.v?`${line.b}.${line.c}.${line.v}`:`${book.id}.${chapter}.${mappedVerse}`);
      for(const target of line.x??[]){
        const sources=incoming.get(target)??new Set();
        sources.add(source);
        incoming.set(target,sources);
        outgoingEdges+=1;
      }
    });
  }
}

const serialized={
  version:1,
  generatedAt:new Date().toISOString(),
  edgeCount:outgoingEdges,
  incoming:Object.fromEntries([...incoming.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([target,sources])=>[target,[...sources].sort()])),
};
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(serialized));
console.log(`Built reverse cross-reference index (${outgoingEdges} edges, ${incoming.size} target verses).`);
