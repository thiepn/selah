import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBsbDisplayJsonl } from '../../dist/src/data/bsb/display-parser.js';
import { ScriptureSearchIndex } from '../../dist/src/search/scripture-index.js';
import { BOOKS } from '../../dist/src/domain/references/books.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const dataRoot=process.env.SELAH_BSB_OUTPUT??join(root,'.generated/data/bsb');
const output=join(root,'.generated/data/selah/scripture-search.json');
const index=new ScriptureSearchIndex();
for(const book of BOOKS){for(let chapter=1;chapter<=book.chapters;chapter+=1){let text; try{text=await readFile(join(dataRoot,`display/${book.id}/${book.id}${chapter}.json`),'utf8');}catch{text=await readFile(join(dataRoot,`display/${book.id}/${book.id}${chapter}.jsonl`),'utf8');}for(const verse of parseBsbDisplayJsonl(text,book.id,chapter))index.add(verse);}}
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(index.serialize()));
console.log(`Built Scripture search index at ${output}`);
