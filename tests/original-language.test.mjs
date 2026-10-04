import test from 'node:test';
import assert from 'node:assert/strict';
import { BsbLexiconProvider } from '../dist/src/research/lexicon/index.js';
import { BsbMorphologyProvider } from '../dist/src/research/morphology/index.js';
import { BsbConcordanceProvider } from '../dist/src/research/concordance/index.js';
import { OriginalLanguageService } from '../dist/src/research/original-language/index.js';

const ref = { book:'PHP', chapter:2, verse:6 };

class Source {
  async getOriginalVerse() {
    return [
      { id:'GRC:PHP.2.6:grc:000', text:'μορφῇ', strongs:'G3444', language:'grc' },
      { id:'GRC:PHP.2.6:grc:001', text:'θεοῦ', strongs:'G2316', language:'grc' },
    ];
  }
}

test('lexicon provider parses object and searches entries', async () => {
  const provider = new BsbLexiconProvider(JSON.stringify({
    G3444:{language:'greek',lemma:'μορφή',transliteration:'morphē',gloss:'form',definition:'form or outward appearance'},
    G2316:{language:'greek',lemma:'θεός',gloss:'God'}
  }));
  assert.equal((await provider.get('G03444')).lemma, 'μορφή');
  assert.equal((await provider.search('form'))[0].strongs, 'G3444');
});

test('original-language service combines token, lexicon, morphology, and concordance without interpreting', async () => {
  const lexicon = new BsbLexiconProvider(JSON.stringify({
    G3444:{language:'greek',lemma:'μορφή',gloss:'form'},
    G2316:{language:'greek',lemma:'θεός',gloss:'God'}
  }));
  const morphology = new BsbMorphologyProvider(JSON.stringify({b:'PHP',c:2,v:6,m:[
    {s:'G3444',m:'N-DSF',p:'noun',l:'μορφή'},
    {s:'G2316',m:'N-GSM',p:'noun',l:'θεός'}
  ]}));
  const concordance = new BsbConcordanceProvider(JSON.stringify({G3444:['MRK.16.12','PHP.2.6','PHP.2.7'],G2316:['PHP.2.6']}));
  const service = new OriginalLanguageService(new Source(), lexicon, morphology, concordance);
  const result = await service.analyzeVerse(ref);
  assert.deepEqual(result[0].ref, ref);
  assert.equal(result[0].lexicon.gloss, 'form');
  assert.equal(result[0].morphology.morphology, 'N-DSF');
  assert.equal(result[0].occurrenceCount, 3);
  assert.deepEqual(result[0].occurrences, [
    {book:'MRK',chapter:16,verse:12},
    {book:'PHP',chapter:2,verse:6},
    {book:'PHP',chapter:2,verse:7},
  ]);
  assert.equal(result[1].lexicon.lemma, 'θεός');
});
