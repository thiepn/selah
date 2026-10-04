import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dataRoot = process.env.SELAH_BSB_OUTPUT ?? join(root, '.generated/data/bsb');
const { BOOKS } = await import('../../dist/src/domain/references/books.js');
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
    const verseCount = Object.keys(parsed.eng ?? {}).length;
    if (!verseCount) throw new Error(`Empty display data: ${book.id} ${chapter}`);
    chapters += 1;
    verses += verseCount;
  }
}
await access(join(dataRoot, 'concordance/strongs-to-verses.json'));
await access(join(dataRoot, 'lexicon/combined_compat.json'));
const manifest = JSON.parse(await readFile(join(dataRoot, 'selah-data-manifest.json'), 'utf8'));
if (manifest.assets < chapters * 2) throw new Error('Vendored asset manifest is incomplete');
console.log(`Validated ${chapters} chapters and ${verses} verses of vendored BSB data.`);
