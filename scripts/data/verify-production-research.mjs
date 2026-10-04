import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BsbScriptureProvider } from '../../dist/src/data/bsb/provider.js';
import { BsbResearchProvider } from '../../dist/src/data/bsb/research-provider.js';
import { parseReference, canonicalVerseId } from '../../dist/src/domain/references/index.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const dataRoot=process.env.SELAH_BSB_OUTPUT??join(root,'.generated/data/bsb');
class FsLoader { async load(path){ return readFile(join(dataRoot,path),'utf8'); } }
const loader=new FsLoader();
const scripture=new BsbScriptureProvider(loader);
const research=new BsbResearchProvider(loader);
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const p=(value)=>parseReference(value).passage;

const genreSamples=['Gen 1:1-5','Ps 23:1-6','Prov 3:1-6','Isa 53:1-6','John 15:1-8','Rom 8:1-4','Rev 21:1-5'];
for(const reference of genreSamples){
  const passage=p(reference);
  const loaded=await scripture.getPassage(passage);
  assert(loaded.verses.length>0,`No Scripture loaded for ${reference}`);
  assert(loaded.verses.every((verse)=>verse.tokens.length>0),`Empty Scripture tokens in ${reference}`);
}

const hebrew=await scripture.getOriginalVerse(p('Gen 1:1').start);
assert(hebrew.length>0 && hebrew.some((token)=>token.language==='hbo'&&token.strongs),'Hebrew original-language tokens missing for Genesis 1:1');
const greek=await scripture.getOriginalVerse(p('Phil 2:6').start);
assert(greek.length>0 && greek.some((token)=>token.language==='grc'&&token.strongs),'Greek original-language tokens missing for Philippians 2:6');

const morphology=await research.forVerse(p('Gen 1:1').start);
assert(morphology?.entries.length,'Hebrew morphology missing for Genesis 1:1');
assert(morphology.entries.some((entry)=>entry.strongs==='H7225'&&entry.morphology),'Expected H7225 morphology not found');

const outgoing=await research.forPassage(p('Phil 2:10'));
assert(outgoing.length>0,'Outgoing cross-references missing for Philippians 2:10');
assert(outgoing.every((ref)=>canonicalVerseId(ref.source.start)==='Phil.2.10'),'Outgoing references are attached to the wrong source verse');

const incoming=await research.backlinksForPassage(p('Isa 45:23'));
assert(incoming.length>0,'Incoming cross-references missing for Isaiah 45:23');
assert(incoming.some((ref)=>canonicalVerseId(ref.source.start)==='Phil.2.10'),'Expected Philippians 2:10 → Isaiah 45:23 backlink missing');

const lexicon=await research.get('G3444');
assert(lexicon?.lemma,'Lexicon lookup failed for G3444');
const occurrences=await research.versesForStrongs('G3444');
assert(occurrences.some((ref)=>canonicalVerseId(ref)==='Phil.2.6'),'Concordance does not include Philippians 2:6 for G3444');

console.log(`Production research smoke passed across ${genreSamples.length} genre samples, Hebrew/Greek tokens, morphology, lexical data, concordance, and bidirectional cross-references.`);
