import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dataRoot = process.env.SELAH_BSB_OUTPUT ?? join(root, '.generated/data/bsb');
const { BOOKS } = await import('../../dist/src/domain/references/books.js');
const presence=JSON.parse(await readFile(join(dataRoot,'verse-presence.json'),'utf8'));
const maxVerses=JSON.parse(await readFile(join(dataRoot,'max-verses.json'),'utf8'));
let chapters = 0;
let verses = 0;
for (const book of BOOKS) {
  for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
    const display = join(dataRoot, `display/${book.id}/${book.id}${chapter}.json`);
    const research = join(dataRoot, `index-cc-by/${book.id}/${book.id}${chapter}.jsonl`);
    await access(display);
    await access(research);
    const text = await readFile(display, 'utf8');
    const parsed = JSON.parse(text);
    const verseNumbers=Object.keys(parsed.eng ?? {}).map(Number).sort((a,b)=>a-b);
    const verseCount = verseNumbers.length;
    if (!verseCount) throw new Error(`Empty display data: ${book.id} ${chapter}`);
    const expectedPresence=presence?.[book.id]?.[String(chapter)];
    if(!Array.isArray(expectedPresence)||JSON.stringify(expectedPresence)!==JSON.stringify(verseNumbers)){
      throw new Error(`Verse-presence map mismatch: ${book.id} ${chapter}`);
    }
    const expectedMax=maxVerses?.[book.id]?.[String(chapter)];
    if(Number(expectedMax)!==Math.max(...verseNumbers))throw new Error(`Max-verse map mismatch: ${book.id} ${chapter}`);
    chapters += 1;
    verses += verseCount;
  }
}
await access(join(dataRoot, 'concordance/strongs-to-verses.json'));
await access(join(dataRoot, 'lexicon/combined_compat.json'));
const manifest = JSON.parse(await readFile(join(dataRoot, 'selah-data-manifest.json'), 'utf8'));
if (manifest.assets < chapters * 2) throw new Error('Vendored asset manifest is incomplete');
console.log(`Validated ${chapters} chapters and ${verses} verses of vendored BSB data.`);
