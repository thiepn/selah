import { formatPassage, parseReference } from './core/domain/references/index.js';
import { TopicOverviewService } from './core/study/topic-overview/index.js';

const e=(value='')=>String(value).replace(/[&<>'"]/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
const LABELS={explicit:'Explicit in text','strong-inference':'Strong inference',tentative:'Tentative',disputed:'Disputed'};

export function topicOverviewContentHtml(overview){
  const books=overview.books.length
    ? `<div class="topic-book-summary">${overview.books.map((book)=>`<span>${e(book.name)} · ${book.count}</span>`).join('')}</div>`
    : '<p class="quiet">No active studies use this topic.</p>';
  const studies=overview.studies.length
    ? overview.studies.map((study)=>`<button class="book-study-card" data-topic-study-id="${e(study.id)}" type="button"><span>${e(formatPassage(study.passage))}</span><strong>${e(study.title)}</strong>${study.mainIdea?`<p>${e(study.mainIdea)}</p>`:''}</button>`).join('')
    : '<p class="quiet">No active studies use this topic.</p>';
  const claims=overview.claims.length
    ? overview.claims.map((claim)=>`<article class="topic-claim"><div class="topic-claim-head"><span class="claim-confidence ${e(claim.confidence)}">${e(LABELS[claim.confidence]??claim.confidence)}</span><small>${e(formatPassage(claim.studyPassage))} · ${e(claim.studyTitle)}</small></div><p>${e(claim.statement)}</p>${claim.evidence.length?`<div class="topic-evidence">${claim.evidence.map((item)=>`<button type="button" data-topic-reference="${e(formatPassage(item.passage))}">${e(formatPassage(item.passage))}</button>${item.note?`<span>${e(item.note)}</span>`:''}`).join('')}</div>`:''}</article>`).join('')
    : '<p class="quiet">No interpretation claims are attached to these studies.</p>';
  const questions=overview.unresolvedQuestions.length
    ? overview.unresolvedQuestions.map((question)=>`<article class="topic-question"><span>${e(formatPassage(question.passage))} · ${e(question.studyTitle)}</span><p>${e(question.body)}</p></article>`).join('')
    : '<p class="quiet">No unresolved questions remain in these studies.</p>';
  return `<div class="book-overview-meta">${overview.studies.length} ${overview.studies.length===1?'study':'studies'} · ${overview.books.length} ${overview.books.length===1?'book':'books'} · ${overview.claims.length} ${overview.claims.length===1?'claim':'claims'} · ${overview.unresolvedQuestions.length} unresolved</div><p class="topic-overview-note">Derived only from your active studies explicitly tagged <strong>${e(overview.topic)}</strong>. Selah does not infer additional topical relationships or generate a theological conclusion.</p><section><span class="mini-label">BOOKS REPRESENTED</span>${books}</section><section><span class="mini-label">STUDIED PASSAGES</span><div class="book-study-list">${studies}</div></section><section><span class="mini-label">INTERPRETATION CLAIMS · ${overview.claims.length}</span><div class="topic-claim-list">${claims}</div></section><section><span class="mini-label">UNRESOLVED QUESTIONS · ${overview.unresolvedQuestions.length}</span><div class="topic-question-list">${questions}</div></section>`;
}

export function createTopicOverviewController({repo,openSnapshot,openReference}){
  const service=new TopicOverviewService(repo);
  const dialog=document.querySelector('#topicOverviewDialog');
  const title=document.querySelector('#topicOverviewTitle');
  const content=document.querySelector('#topicOverviewContent');
  if(!dialog||!title||!content)return {open:async()=>{}};

  const open=async(topic)=>{
    const overview=await service.overview(topic);
    title.textContent=overview.topic;
    content.innerHTML=topicOverviewContentHtml(overview);
    content.querySelectorAll('[data-topic-study-id]').forEach((button)=>button.addEventListener('click',async()=>{
      dialog.close();
      await openSnapshot(button.dataset.topicStudyId);
    }));
    content.querySelectorAll('[data-topic-reference]').forEach((button)=>button.addEventListener('click',()=>{
      dialog.close();
      openReference(parseReference(button.dataset.topicReference).passage);
    }));
    if(!dialog.open)dialog.showModal();
  };

  document.addEventListener('click',(event)=>{
    const button=event.target.closest?.('[data-topic-overview]');
    if(!button)return;
    event.preventDefault();
    const parentDialog=button.closest('dialog[open]');
    if(parentDialog&&parentDialog!==dialog)parentDialog.close();
    open(button.dataset.topicOverview).catch(()=>{});
  });
  return {open};
}
