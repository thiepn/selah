import { formatPassage } from './core/domain/references/index.js';

const escapeHtml = (value='') => value.replace(/[&<>'"]/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));

export function bookOverviewContentHtml(overview) {
  const topics=overview.topics.length
    ? `<div class="book-topic-summary">${overview.topics.map((x)=>`<button type="button" data-topic-overview="${escapeHtml(x.label)}">${escapeHtml(x.label)}${x.count>1?` × ${x.count}`:''}</button>`).join('')}</div>`
    : '<p class="quiet">No study topics assigned in this book yet.</p>';
  const studies=overview.studies.length
    ? overview.studies.map((x)=>`<button class="book-study-card" data-book-study-id="${escapeHtml(x.id)}" type="button"><span>${escapeHtml(formatPassage(x.passage))}</span><strong>${escapeHtml(x.title)}</strong>${x.mainIdea?`<p>${escapeHtml(x.mainIdea)}</p>`:''}</button>`).join('')
    : '<p class="quiet">No active passage studies in this book yet.</p>';
  const questions=overview.unresolvedQuestions.length
    ? overview.unresolvedQuestions.slice(0,8).map((x)=>`<div class="book-question"><span>${escapeHtml(formatPassage(x.passage))}</span><p>${escapeHtml(x.body)}</p></div>`).join('')
    : '<p class="quiet">No unresolved saved questions in this book.</p>';
  return `<div class="book-overview-meta">${overview.studies.length} passage ${overview.studies.length===1?'study':'studies'} · ${overview.unresolvedQuestions.length} unresolved ${overview.unresolvedQuestions.length===1?'question':'questions'}</div><section><span class="mini-label">YOUR TOPICS</span>${topics}</section><section><span class="mini-label">STUDIED PASSAGES</span><div class="book-study-list">${studies}</div></section><section><span class="mini-label">UNRESOLVED QUESTIONS · ${overview.unresolvedQuestions.length}</span><div class="book-question-list">${questions}</div></section>`;
}
