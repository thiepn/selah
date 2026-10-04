import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS } from '../../dist/src/domain/references/books.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const dataRoot=process.env.SELAH_BSB_OUTPUT??join(root,'.generated/data/bsb');
const concordance=new Map();

for(const book of BOOKS){
  for(let chapter=1;chapter<=book.chapters;chapter+=1){
    const [text,mapText]=await Promise.all([
      readFile(join(dataRoot,`index-cc-by/${book.id}/${book.id}${chapter}.jsonl`),'utf8'),
      readFile(join(dataRoot,`research-verse-map/${book.id}/${book.id}${chapter}.json`),'utf8'),
    ]);
    const verseNumbers=JSON.parse(mapText);
    const lines=text.split(/\r?\n/).map((x)=>x.trim()).filter(Boolean);
    lines.forEach((raw,index)=>{
      const line=JSON.parse(raw);
      const verse=verseNumbers[index];
      if(!Number.isInteger(verse))throw new Error(`Research verse map missing ${book.id} ${chapter} line ${index+1}`);
      const ref=`${book.id}.${chapter}.${verse}`;
      for(const strongs of new Set(line.s??[])){
        if(typeof strongs!=='string'||!strongs)continue;
        const refs=concordance.get(strongs)??new Set();
        refs.add(ref);
        concordance.set(strongs,refs);
      }
    });
  }
}

const serialized=Object.fromEntries([...concordance.entries()]
  .sort(([a],[b])=>a.localeCompare(b))
  .map(([strongs,refs])=>[strongs,[...refs]]));
await writeFile(join(dataRoot,'concordance/strongs-to-verses.json'),JSON.stringify(serialized));
console.log(`Built canonical Strong's concordance for ${concordance.size} lexical keys.`);
