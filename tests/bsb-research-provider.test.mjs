import test from 'node:test';
import assert from 'node:assert/strict';
import { BsbResearchProvider } from '../dist/src/data/bsb/index.js';
import { parseReference } from '../dist/src/domain/references/index.js';

class Loader {
  calls=[];
  async load(path){
    this.calls.push(path);
    if(path.includes('index-cc-by')) return JSON.stringify({id:'PHP.2.6',b:'PHP',c:2,v:6,x:['ISA.45.23'],m:[{s:'G3444',m:'N-DSF',p:'noun',l:'μορφή'}]});
    if(path.includes('lexicon')) return JSON.stringify({G3444:{language:'greek',lemma:'μορφή',gloss:'form'}});
    if(path.includes('concordance')) return JSON.stringify({G3444:['MRK.16.12','PHP.2.6','PHP.2.7']});
    if(path.includes('crossrefs/reverse')) return JSON.stringify({version:1,incoming:{'PHP.2.6':['JHN.1.14']}});
    throw new Error(path);
  }
}

test('BSB research provider lazily composes chapter research, lexicon, and concordance', async()=>{
  const loader=new Loader(); const provider=new BsbResearchProvider(loader); const p=parseReference('Phil 2:6').passage;
  assert.equal((await provider.forPassage(p))[0].target.start.book,'ISA');
  assert.equal((await provider.forVerse(p.start)).entries[0].lemma,'μορφή');
  assert.equal((await provider.backlinksForPassage(p))[0].source.start.book,'JHN');
  assert.equal((await provider.get('G3444')).gloss,'form');
  assert.equal((await provider.versesForStrongs('G3444')).length,3);
  await provider.get('G3444'); await provider.forVerse(p.start);
  assert.equal(loader.calls.filter((x)=>x.includes('lexicon')).length,1);
  assert.equal(loader.calls.filter((x)=>x.includes('index-cc-by')).length,1);
  assert.equal(loader.calls.filter((x)=>x.includes('crossrefs/reverse')).length,1);
});


test('BSB research provider maps compact positional chapter records onto requested verses', async()=>{
  class CompactLoader {
    async load(path){
      if(path.includes('index-cc-by')) return [
        JSON.stringify({x:['JHN.1.1'],m:[{s:'H7225',m:'HR/Ncfsa',p:'noun',l:'בְּ/רֵאשִׁית'}]}),
        JSON.stringify({x:['ROM.1.1'],m:[]}),
      ].join('\n');
      if(path.includes('crossrefs/reverse')) return JSON.stringify({version:1,incoming:{}});
      if(path.includes('lexicon')) return '{}';
      if(path.includes('concordance')) return '{}';
      throw new Error(path);
    }
  }
  const provider=new BsbResearchProvider(new CompactLoader());
  const refs=await provider.forPassage(parseReference('Gen 1:2').passage);
  assert.equal(refs[0].source.start.verse,2);
  const morph=await provider.forVerse(parseReference('Gen 1:1').passage.start);
  assert.equal(morph.ref.verse,1);
  assert.equal(morph.entries[0].strongs,'H7225');
});
