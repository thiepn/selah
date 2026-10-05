import { formatPassage } from './core/domain/references/index.js';
import { PersonalStudySearchIndex } from './core/search/index.js';

const esc=(value='')=>value.replace(/[&<>'"]/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
const SOURCE_TAB={document:'notes',annotation:'notes',outline:'outline',claim:'claims',synthesis:'synthesis'};
const SOURCE_LABEL={study:'Study',document:'Notes',annotation:'Annotation',outline:'Outline',claim:'Claim','book-synthesis':'Book',synthesis:'Synthesis',review:'Review'};

export async function searchWorkspaceUI(container,query,deps){
  const {searchScripture,repo,resolveReference,switchPassage,openStudy,openBook}=deps;
  container.innerHTML='<div class="loading">Searching Scripture and studies…</div>';
  const [scriptureResults,snapshot]=await Promise.all([searchScripture(query,30).catch(()=>[]),repo.exportSnapshot()]);
  const personal=new PersonalStudySearchIndex();
  personal.rebuild({studies:snapshot.studies,documents:snapshot.studyDocuments,outlines:snapshot.studyOutlines,claims:snapshot.interpretationClaims,bookSyntheses:snapshot.bookSyntheses,syntheses:snapshot.studySyntheses,reviewCards:snapshot.reviewCards,annotations:snapshot.annotations});
  const personalResults=personal.search(query,30);
  container.innerHTML=`<section class="panel"><span class="eyebrow">SEARCH</span><h2>${esc(query)}</h2><p class="panel-lede">Search Scripture and your own study material. Results return to the tool that produced them.</p><section class="panel-section"><h3>Scripture</h3>${scriptureResults.map((result)=>`<button class="reference-card search-scripture" type="button" data-reference="${esc(formatPassage({start:result.ref,end:result.ref}))}"><strong>${esc(formatPassage({start:result.ref,end:result.ref}))}</strong><span>${esc(result.text)}</span></button>`).join('')||'<p class="quiet">No Scripture matches.</p>'}</section><section class="panel-section"><h3>Your studies</h3>${personalResults.map((result)=>`<button class="reference-card search-personal" type="button" data-kind="${esc(result.kind)}"${result.studyId?` data-study-id="${esc(result.studyId)}"`:''}${result.bookId?` data-book-id="${esc(result.bookId)}"`:''}><span class="search-source">${esc(SOURCE_LABEL[result.kind]??result.kind)}</span><strong>${esc(result.title)}</strong><span>${esc(result.excerpt)}</span></button>`).join('')||'<p class="quiet">No personal-study matches.</p>'}</section></section>`;
  container.querySelectorAll('.search-scripture').forEach((button)=>button.addEventListener('click',async()=>switchPassage(await resolveReference(button.dataset.reference))));
  container.querySelectorAll('.search-personal[data-study-id]').forEach((button)=>button.addEventListener('click',async()=>openStudy(button.dataset.studyId,SOURCE_TAB[button.dataset.kind])));
  container.querySelectorAll('.search-personal[data-book-id]').forEach((button)=>button.addEventListener('click',async()=>openBook(button.dataset.bookId)));
}
