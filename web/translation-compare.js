import { compareVerseRefs, formatPassage } from './core/domain/references/index.js';
import { TranslationRegistry } from './core/research/compare/index.js';
import { WebScriptureProvider, FetchWebAssetLoader } from './core/data/web/index.js';

const escapeHtml=(value='')=>value.replace(/[&<>'"]/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
const verseId=(ref)=>`${ref.book}.${ref.chapter}.${ref.verse}`;
const verseText=(verse)=>verse.tokens.map((token)=>token.text).join('');

export function createTranslationRegistry(primaryProvider) {
  return new TranslationRegistry([
    primaryProvider,
    new WebScriptureProvider(new FetchWebAssetLoader('./data/web')),
  ]);
}

export async function comparisonPanelHtml(registry,passage) {
  const result=await registry.compare(passage,registry.list().map((translation)=>translation.id));
  const translations=result.translations;
  const refs=new Map();
  for(const {scripture} of translations)for(const verse of scripture.verses)refs.set(verseId(verse.ref),verse.ref);
  const ordered=[...refs.values()].sort(compareVerseRefs);
  const multiChapter=passage.start.chapter!==passage.end.chapter;
  const maps=translations.map(({scripture})=>new Map(scripture.verses.map((verse)=>[verseId(verse.ref),verse])));
  const headers=translations.map(({metadata})=>`<div class="compare-translation-head"><strong>${escapeHtml(metadata.abbreviation)}</strong><span>${escapeHtml(metadata.name)}</span></div>`).join('');
  const rows=ordered.map((ref)=>{
    const key=verseId(ref);
    const label=multiChapter?`${ref.chapter}:${ref.verse}`:String(ref.verse);
    const cells=maps.map((map)=>{
      const verse=map.get(key);
      return `<div class="compare-cell">${verse?escapeHtml(verseText(verse)):'<span class="compare-missing">Not present in this edition</span>'}</div>`;
    }).join('');
    return `<div class="compare-row"><div class="compare-ref">${escapeHtml(label)}</div>${cells}</div>`;
  }).join('');
  const unavailable=result.unavailable.length?`<p class="quiet">Unavailable for this passage: ${result.unavailable.map(escapeHtml).join(', ')}.</p>`:'';
  return `<section class="panel compare-panel"><span class="eyebrow">COMPARE</span><h2>${escapeHtml(formatPassage(passage))}</h2><p class="panel-lede">Compare wording verse by verse. Differences are evidence to investigate, not automatic interpretations.</p><div class="parallel-compare" style="--compare-cols:${translations.length}"><div class="compare-head"><div></div>${headers}</div>${rows}</div>${unavailable}</section>`;
}
