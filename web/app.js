import { parseReference, formatPassage, canonicalPassageId, compareVerseRefs, BOOK_BY_ID, BOOKS, VerseBoundsIndex } from './core/domain/references/index.js';
import { PassageContextStore } from './core/domain/context/index.js';
import { createResearchTrail, extractStudyDocumentScriptureLinks } from './core/domain/studies/index.js';
import { IndexedDbSelahRepository, createBackup, parseBackup } from './core/persistence/index.js';
import { BsbScriptureProvider, FetchTextAssetLoader, BsbResearchProvider } from './core/data/bsb/index.js';
import { AnnotationService, annotationMatchesPassage } from './core/annotations/index.js';
import { StudyService, WorkspaceService, OutlineService, BookSynthesisService, studiesOverlappingPassage } from './core/study/index.js';
import { LensService } from './core/study/lens/index.js';
import { PassageGuideService } from './core/study/guide/index.js';
import { OriginalLanguageService } from './core/research/original-language/index.js';
import { analyzePatterns, analyzeStructuralMarkers } from './core/bible/patterns/index.js';
import { indentPhrase, outdentPhrase, updatePhraseNode, splitPhraseNode, mergePhraseWithPrevious } from './core/bible/phrasing/index.js';
import { exportStudyContextMarkdown } from './core/export/index.js';
import { ScriptureSearchIndex } from './core/search/index.js';
import { ReviewService } from './core/review/index.js';
import { connectedReferenceCardHtml, personalStudyLinksHtml, wirePersonalStudyReferences as wireRef } from './personal-reference-ui.js';
import { bookOverviewContentHtml } from './book-overview.js';
import { createTopicOverviewController } from './topic-overview.js';
import { modeControlHtml, promptLabel } from './guide-literary-mode.js';
import { createTranslationRegistry, comparisonPanelHtml } from './translation-compare.js';
import { claimsUI, claimsSummaryHtml, claimsSnapshotHtml } from './interpretation-claims.js';
import { searchWorkspaceUI } from './search-workspace.js';
import { drawerController, regionController, mobileSheetController } from './a11y-overlays.js';
const $ = (selector) => document.querySelector(selector);
const queryAll = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (value='') => value.replace(/[&<>'"]/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
const sleep = (ms) => new Promise((resolve)=>setTimeout(resolve,ms));
const elements = {
  scripture: $('#scripture'), studyContent: $('#studyContent'), referenceInput: $('#referenceInput'), passageStatus: $('#passageStatus'),
  selectionMenu: $('#selectionMenu'), noteDialog: $('#noteDialog'), noteForm: $('#noteForm'), noteBody: $('#noteBody'), noteAnchorLabel: $('#noteAnchorLabel'),
  saveState: $('#saveState'), peek: $('#peek'), peekTitle: $('#peekTitle'), peekText: $('#peekText'), peekOpen: $('#peekOpen'),
  studiesDrawer: $('#studiesDrawer'), studiesList: $('#studiesList'), studySearch: $('#studySearch'), reviewDrawer: $('#reviewDrawer'), reviewContent: $('#reviewContent'), exportDialog: $('#exportDialog'), toast: $('#toast')
};
const studiesDrawerCtl=drawerController(elements.studiesDrawer,{initialFocus:()=>elements.studySearch});
const reviewDrawerCtl=drawerController(elements.reviewDrawer,{initialFocus:()=>$('#reviewClose')});
const peekCtl=regionController(elements.peek,{initialFocus:()=>$('#peekClose')});
const mobileStudyCtl=mobileSheetController($('#studyPane'),$('#mobileStudyToggle'));
const repo = new IndexedDbSelahRepository();
await repo.initialize();
const loader = new FetchTextAssetLoader('./data/bsb');
const scriptureProvider = new BsbScriptureProvider(loader);
const researchProvider = new BsbResearchProvider(loader);
const annotationService = new AnnotationService(repo);
const studyService = new StudyService(repo);
const workspaceService = new WorkspaceService(repo);
const outlineService = new OutlineService(repo);
const bookSynthesisService = new BookSynthesisService(repo);
const reviewService = new ReviewService(repo);
const guideService = new PassageGuideService(annotationService, researchProvider, scriptureProvider, researchProvider);
const lensService = new LensService(annotationService, researchProvider);
const originalLanguage = new OriginalLanguageService(scriptureProvider, researchProvider, researchProvider, researchProvider);
const translations = createTranslationRegistry(scriptureProvider);
createTopicOverviewController({repo,openSnapshot:openStudySnapshot,openReference:openPeek});
function syncTranslationComparisonAvailability() {
  const available=translations.list().length>1;
  const compareTab=$('[data-tab="compare"]');
  const compareAction=$('[data-action="compare"]');
  if(compareTab)compareTab.hidden=!available;
  if(compareAction)compareAction.hidden=!available;
  if(!available&&activeTab==='compare')activeTab='guide';
}
let currentScripture;
let currentStudy;
let workspace;
let activeTab = 'guide';
let selectedToken;
let selectedLexicalKey;
let selectedRangeInfo;
let activePeekPassage;
let patternTokenIds = new Set();
let phrasingDocument;
let phrasingSplitNodeId;
let noteSaveTimer;
let synthesisSaveTimer;
let reviewReconcileTimer;
let bookOverviewSaveTimer;
let pendingBookUnderstandingSave;
let outlineDraftPassage;
let focusedObservationPromptId;
let pendingAnnotationKind='note';
let editingAnnotationId;
let editingAnnotationField;
let showArchivedStudies=false;
let studyArchiveView='books';
let editingStudyId;
let snapshotStudyId;
let reviewStudyFilter;
let reviewCardStudyId;
let editingReviewCardId;
let activeBookId;
let scriptureSearchIndexPromise;
let scriptureSearchWorker;
let scriptureSearchRequestId=0;
const scriptureSearchPending=new Map();
let verseBoundsPromise;
const contextSeedPassage = parseReference('Phil 2:5-11').passage;
workspace = await workspaceService.restoreLast();
const context = new PassageContextStore({
  primaryPassage: workspace?.primaryPassage ?? contextSeedPassage,
  translationId: workspace?.translationId ?? 'BSB',
});
function toast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(()=>elements.toast.hidden = true, 1800);
}
function setSaving(saving) {
  elements.saveState.textContent = saving ? 'saving…' : 'saved locally';
}
function samePassage(a,b) { return canonicalPassageId(a) === canonicalPassageId(b); }
function studyDraftKey(passage) {
  return `selah.study-document-draft.${canonicalPassageId(passage)}`;
}
function readStudyDraft(passage) {
  try {
    const raw=localStorage.getItem(studyDraftKey(passage));
    if(!raw)return undefined;
    const parsed=JSON.parse(raw);
    return typeof parsed?.value==='string'&&Number.isFinite(parsed?.updatedAt)?parsed:undefined;
  } catch { return undefined; }
}
function writeStudyDraft(passage,value) {
  const revision=crypto.randomUUID();
  try { localStorage.setItem(studyDraftKey(passage),JSON.stringify({value,updatedAt:Date.now(),revision})); } catch {}
  return revision;
}
function clearStudyDraft(passage,revision) {
  try {
    const key=studyDraftKey(passage);
    const raw=localStorage.getItem(key);
    if(!raw)return;
    const current=JSON.parse(raw);
    if(current?.revision===revision)localStorage.removeItem(key);
  } catch {}
}
async function loadVerseBounds() {
  verseBoundsPromise ??= Promise.all([
    fetch('./data/bsb/max-verses.json').then(async(response)=>response.ok?response.json():undefined),
    fetch('./data/bsb/verse-presence.json').then(async(response)=>response.ok?response.json():undefined).catch(()=>undefined),
  ]).then(([bounds,presence])=>bounds?new VerseBoundsIndex(bounds,presence):undefined).catch(()=>undefined);
  return verseBoundsPromise;
}
async function loadScriptureSearchIndex() {
  scriptureSearchIndexPromise ??= fetch('./data/selah/scripture-search.json').then(async(response)=>{if(!response.ok)throw new Error('Scripture search index is not installed');return ScriptureSearchIndex.fromSerialized(await response.json());});
  return scriptureSearchIndexPromise;
}
function getScriptureSearchWorker() {
  if (typeof Worker === 'undefined') return undefined;
  if (scriptureSearchWorker) return scriptureSearchWorker;
  scriptureSearchWorker = new Worker('./search-worker.js',{type:'module'});
  scriptureSearchWorker.addEventListener('message',(event)=>{
    const {id,results,error}=event.data??{};
    const pending=scriptureSearchPending.get(id);
    if(!pending)return;
    scriptureSearchPending.delete(id);
    if(error)pending.reject(new Error(error));
    else pending.resolve(results??[]);
  });
  scriptureSearchWorker.addEventListener('error',(event)=>{
    for(const pending of scriptureSearchPending.values()) pending.reject(new Error(event.message||'Scripture search worker failed'));
    scriptureSearchPending.clear();
    scriptureSearchWorker?.terminate();
    scriptureSearchWorker=undefined;
  });
  return scriptureSearchWorker;
}
async function searchScripture(query,limit=30) {
  const worker=getScriptureSearchWorker();
  if(!worker) return (await loadScriptureSearchIndex()).search(query,limit);
  const id=++scriptureSearchRequestId;
  return new Promise((resolve,reject)=>{
    scriptureSearchPending.set(id,{resolve,reject});
    worker.postMessage({id,query,limit});
  });
}
async function renderSearchResults(query){
  return searchWorkspaceUI(elements.studyContent,query,{searchScripture,repo,resolveReference:resolveReferenceInput,switchPassage:switchPrimaryPassage,openStudy:openStudyById,openBook:openBookOverview});
}
async function resolveReferenceInput(input) {
  const parsed = parseReference(input);
  if (parsed.kind === 'passage') {
    const bounds=await loadVerseBounds();
    bounds?.validatePassage(parsed.passage);
    const scripture=await scriptureProvider.getPassage(parsed.passage);
    const first=scripture.verses[0]?.ref; const last=scripture.verses.at(-1)?.ref;
    const sameRef=(a,b)=>Boolean(a&&b&&a.book===b.book&&a.chapter===b.chapter&&a.verse===b.verse);
    if(!sameRef(first,parsed.passage.start)||!sameRef(last,parsed.passage.end)) throw new Error('That passage is unavailable in the current Scripture dataset.');
    return scripture;
  }
  const broad = { start:{book:parsed.book,chapter:parsed.chapter,verse:1}, end:{book:parsed.book,chapter:parsed.chapter,verse:200} };
  const scripture = await scriptureProvider.getPassage(broad);
  if (!scripture.verses.length) throw new Error('That chapter is unavailable in the current Scripture dataset.');
  scripture.passage = { start: scripture.verses[0].ref, end: scripture.verses.at(-1).ref };
  return scripture;
}
async function switchPrimaryPassage(scripture) {
  currentStudy = await studyService.forPassage(scripture.passage);
  const workspaces = currentStudy ? (await repo.listWorkspaces()).filter((x)=>x.studyId === currentStudy.id) : [];
  if (workspaces.length) {
    workspace = workspaces.sort((a,b)=>b.updatedAt-a.updatedAt)[0];
    workspace = { ...workspace, primaryPassage: structuredClone(scripture.passage), researchTrail:createResearchTrail({passage:scripture.passage}), updatedAt:Date.now() };
    await repo.putWorkspace(workspace);
  } else if (!workspace) {
    workspace = await workspaceService.create(scripture.passage, scripture.translationId, currentStudy?.id);
  } else {
    workspace = { ...workspace, primaryPassage: structuredClone(scripture.passage), studyId: currentStudy?.id, researchTrail:createResearchTrail({passage:scripture.passage}), updatedAt:Date.now() };
    if (!currentStudy) delete workspace.studyId;
    await repo.putWorkspace(workspace);
  }
  await workspaceService.markLastOpened(workspace);
  await setCurrentScripture(scripture);
}
async function setCurrentScripture(scripture) {
  if(!currentStudy||!samePassage(currentStudy.primaryPassage,scripture.passage))currentStudy=await studyService.forPassage(scripture.passage);
  if(workspace&&workspace.studyId!==currentStudy?.id){workspace={...workspace,studyId:currentStudy?.id,updatedAt:Date.now()};if(!currentStudy)delete workspace.studyId;await repo.putWorkspace(workspace);}
  document.body.classList.remove('launcher-mode');
  currentScripture = scripture;
  selectedToken = undefined;
  selectedRangeInfo = undefined;
  focusedObservationPromptId = undefined;
  patternTokenIds.clear();
  phrasingDocument = undefined;
  context.set({ primaryPassage: scripture.passage, translationId: scripture.translationId });
  elements.referenceInput.value = formatPassage(scripture.passage);
  elements.passageStatus.textContent = formatPassage(scripture.passage);
  document.title = `${formatPassage(scripture.passage)} — Selah`;
  $('#patternsBtn').disabled=false;
  await renderScripture();
  await renderActiveTab();
  updateHistoryButtons();
  updateChapterButtons();
}
function renderPassageLauncher(message='Enter a Bible reference above to begin.') {
  document.body.classList.add('launcher-mode');
  currentScripture=undefined;
  currentStudy=undefined;
  selectedToken=undefined;
  selectedRangeInfo=undefined;
  patternTokenIds.clear();
  elements.referenceInput.value='';
  elements.passageStatus.textContent='No passage open';
  document.title='Selah';
  elements.scripture.innerHTML=`<div class="passage-launcher"><span class="launcher-wordmark">SELAH</span><h1>What are you studying?</h1><p>${escapeHtml(message)}</p><button class="primary-button" id="launcherReference" type="button">Choose a passage</button></div>`;
  elements.studyContent.innerHTML=`<section class="study-empty"><span class="eyebrow">STUDY WORKSPACE</span><p>Study tools follow the open passage. Saved studies remain under <strong>Studies</strong>.</p><button class="text-button" id="launcherStudies" type="button">Open saved studies</button></section>`;
  $('#backBtn').disabled=true;
  $('#forwardBtn').disabled=true;
  $('#prevChapterBtn').disabled=true;
  $('#nextChapterBtn').disabled=true;
  $('#patternsBtn').disabled=true;
  $('#launcherReference')?.addEventListener('click',()=>{elements.referenceInput.focus();});
  $('#launcherStudies')?.addEventListener('click',()=>$('#studiesBtn').click());
  requestAnimationFrame(()=>elements.referenceInput.focus());
}
async function loadInitial() {
  if (!workspace) {
    renderPassageLauncher();
    return;
  }
  try {
    const scripture = await scriptureProvider.getPassage(workspace.primaryPassage);
    currentStudy = workspace.studyId ? await repo.getStudy(workspace.studyId) : await studyService.forPassage(scripture.passage);
    await setCurrentScripture(scripture);
  } catch (error) {
    workspace=undefined;
    renderPassageLauncher('The previous passage is not available in this installed Scripture data. Choose another passage or open a saved study.');
  }
}
function scriptureTokens() { return currentScripture?.verses.flatMap((verse)=>verse.tokens) ?? []; }
function tokenById(id) { return scriptureTokens().find((token)=>token.id===id); }
function verseByTokenId(id) { return currentScripture?.verses.find((verse)=>verse.tokens.some((token)=>token.id===id)); }
async function renderScripture() {
  if (!currentScripture) return;
  const [annotations,outline] = await Promise.all([
    annotationService.forPassage(currentScripture.passage,currentScripture.translationId,currentStudy?.id),
    currentStudy ? outlineService.get(currentStudy.id) : Promise.resolve(undefined),
  ]);
  const outlineStarts=new Map((outline?.sections??[]).map((section)=>[
    `${section.passage.start.book}.${section.passage.start.chapter}.${section.passage.start.verse}`,
    section,
  ]));
  const noteVerses = new Set();
  for (const annotation of annotations) {
    if (annotation.kind !== 'note' && annotation.kind !== 'question') continue;
    for (const verse of currentScripture.verses) {
      if (annotationMatchesPassage(annotation,{start:verse.ref,end:verse.ref})) {
        noteVerses.add(`${verse.ref.book}.${verse.ref.chapter}.${verse.ref.verse}`);
      }
    }
  }
  let previousHeading;
  let previousChapter;
  const html = [];
  const book = BOOK_BY_ID.get(currentScripture.passage.start.book);
  for (const verse of currentScripture.verses) {
    if (verse.ref.chapter !== previousChapter) {
      html.push(previousChapter===undefined
        ? `<h1>${escapeHtml(book?.name ?? currentScripture.passage.start.book)} ${verse.ref.chapter}</h1>`
        : `<h2 class="chapter-heading">${escapeHtml(book?.name ?? currentScripture.passage.start.book)} ${verse.ref.chapter}</h2>`);
      previousChapter = verse.ref.chapter;
      previousHeading = undefined;
    }
    const refKey = `${verse.ref.book}.${verse.ref.chapter}.${verse.ref.verse}`;
    const userSection=outlineStarts.get(refKey);
    if(userSection){
      html.push(`<button class="user-outline-boundary" data-open-outline-from-scripture type="button"><span>YOUR OUTLINE · ${escapeHtml(formatPassage(userSection.passage))}</span><strong>${escapeHtml(userSection.label||'Untitled section')}</strong></button>`);
    }
    if (verse.heading && verse.heading !== previousHeading) {
      html.push(`<p class="section-heading">${escapeHtml(verse.heading)}</p>`);
      previousHeading = verse.heading;
    }
    const hasNote = noteVerses.has(refKey) ? ' has-note' : '';
    const tokenHtml = verse.tokens.map((token)=>`<span class="token${patternTokenIds.has(token.id)?' pattern-hit':''}" data-token-id="${escapeHtml(token.id)}"${token.strongs?` data-strongs="${escapeHtml(token.strongs)}"`:''}>${escapeHtml(token.text)}</span>`).join('');
    html.push(`<p class="verse${hasNote}" data-book="${verse.ref.book}" data-chapter="${verse.ref.chapter}" data-verse="${verse.ref.verse}"><button class="verse-number" type="button" aria-label="Verse ${verse.ref.verse}">${verse.ref.verse}</button>${tokenHtml}</p>`);
  }
  elements.scripture.innerHTML = html.join('');
  applyAnnotationHighlights(annotations);
  queryAll('[data-open-outline-from-scripture]').forEach((button)=>button.addEventListener('click',async()=>{
    activeTab='outline';
    await renderActiveTab();
    if(matchMedia('(max-width:760px)').matches)$('#studyPane').classList.add('open');
  }));
}
function applyAnnotationHighlights(annotations) {
  const tokenEls = queryAll('.token');
  for (const annotation of annotations) {
    if (annotation.kind !== 'highlight') continue;
    if (annotation.anchor.type !== 'text' && annotation.anchor.type !== 'text-range') continue;
    if (annotation.anchor.translationId !== currentScripture.translationId) continue;
    const start = tokenEls.findIndex((el)=>el.dataset.tokenId===annotation.anchor.startTokenId);
    const end = tokenEls.findIndex((el)=>el.dataset.tokenId===annotation.anchor.endTokenId);
    if (start < 0 || end < 0) continue;
    for (let i=Math.min(start,end);i<=Math.max(start,end);i++) tokenEls[i].classList.add('annotation-highlight');
  }
}
function tokenElementFromNode(node) {
  const el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return el?.closest?.('[data-token-id]');
}
function selectedTokenRange() {
  const selection = getSelection();
  if (!selection || selection.rangeCount===0 || selection.isCollapsed || !elements.scripture.contains(selection.anchorNode) || !elements.scripture.contains(selection.focusNode)) return undefined;
  const startEl = tokenElementFromNode(selection.anchorNode);
  const endEl = tokenElementFromNode(selection.focusNode);
  if (!startEl || !endEl) return undefined;
  const tokenEls = queryAll('.token');
  const a = tokenEls.indexOf(startEl); const b = tokenEls.indexOf(endEl);
  if (a<0 || b<0) return undefined;
  const first = tokenEls[Math.min(a,b)], last = tokenEls[Math.max(a,b)];
  const firstVerse = first.closest('.verse'), lastVerse = last.closest('.verse');
  const passage = {
    start:{book:firstVerse.dataset.book,chapter:Number(firstVerse.dataset.chapter),verse:Number(firstVerse.dataset.verse)},
    end:{book:lastVerse.dataset.book,chapter:Number(lastVerse.dataset.chapter),verse:Number(lastVerse.dataset.verse)}
  };
  return { startTokenId:first.dataset.tokenId, endTokenId:last.dataset.tokenId, passage, quotedText:selection.toString().trim(), sameVerse:passage.start.book===passage.end.book&&passage.start.chapter===passage.end.chapter&&passage.start.verse===passage.end.verse };
}
async function ensureStudy() {
  if (currentStudy) return currentStudy;
  currentStudy = await studyService.create(currentScripture.passage);
  workspace = { ...workspace, studyId: currentStudy.id, updatedAt:Date.now() };
  await repo.putWorkspace(workspace);
  await workspaceService.markLastOpened(workspace);
  return currentStudy;
}
async function renderGuide() {
  elements.studyContent.innerHTML='<div class="loading">Building passage guide…</div>';
  try {
    const [guide,outline,studyAnnotations,studies] = await Promise.all([
      guideService.build(currentScripture,currentStudy?.literaryMode),
      currentStudy ? outlineService.get(currentStudy.id) : Promise.resolve(undefined),
      currentStudy ? annotationService.forPassage(currentScripture.passage,currentScripture.translationId,currentStudy.id) : Promise.resolve([]),
      repo.listStudies(),
    ]);
    const priorStudies=studiesOverlappingPassage(studies,currentScripture.passage).filter((study)=>study.id!==currentStudy?.id);
    const priorStudiesHtml=personalStudyLinksHtml(Array.isArray(priorStudies)?priorStudies:[],formatPassage(currentScripture.passage));
    const questions=studyAnnotations.filter((annotation)=>annotation.kind==='question');
    const unansweredQuestions=questions.filter((annotation)=>!annotation.response?.trim());
    const questionsHtml=questions.length
      ? `<div class="study-question-summary">${[...questions].sort((a,b)=>Number(Boolean(a.response?.trim()))-Number(Boolean(b.response?.trim()))).slice(0,8).map((question)=>`<div class="${question.response?.trim()?'answered':'unanswered'}"><span>${question.response?.trim()?'Answered':'Unanswered'}</span><p>${escapeHtml(question.body??'Question')}</p></div>`).join('')}</div><div class="question-summary-footer"><span>${unansweredQuestions.length} unresolved</span><button class="text-button" type="button" data-open-study-questions>Open in Notes</button></div>`
      : '<p class="quiet">No saved study questions yet.</p>';
    const book = BOOK_BY_ID.get(currentScripture.passage.start.book);
    const outlineHtml=outline?.sections.length
      ? `<div class="guide-outline">${outline.sections.map((section)=>`<div><span>${escapeHtml(formatPassage(section.passage))}</span><strong>${escapeHtml(section.label||'Untitled section')}</strong></div>`).join('')}</div>`
      : '<p class="quiet">You have not outlined this passage yet.</p>';
    elements.studyContent.innerHTML = `<section class="panel">
      <span class="eyebrow">PASSAGE GUIDE</span><h2>${escapeHtml(formatPassage(currentScripture.passage))}</h2>
      <p class="panel-lede">A map of study directions. It points to evidence without replacing close reading.</p>
      ${modeControlHtml(currentScripture.passage,currentStudy?.literaryMode)}
      <section class="panel-section observation-guide"><h3>Observe the text</h3><p class="quiet">These questions come from visible textual signals. Selah asks; it does not supply the interpretation.</p><div class="observation-prompts">${guide.observationPrompts.map((prompt,index)=>`<article class="observation-prompt"><span class="observation-category">${escapeHtml(promptLabel(prompt.category,guide.literaryMode))}</span><p>${escapeHtml(prompt.prompt)}</p><div class="observation-actions">${prompt.tokenIds.length?`<button class="text-button" type="button" data-observation-focus="${index}">Show in text</button>`:''}<button class="text-button" type="button" data-observation-save="${index}">Save question</button></div></article>`).join('')}</div></section>
      <section class="panel-section"><h3>Context</h3><dl class="facts"><div><dt>Book</dt><dd>${escapeHtml(book?.name??'')}</dd></div><div><dt>Canon</dt><dd>${book?.testament==='NT'?'New Testament':'Old Testament'}</dd></div><div><dt>Your annotations</dt><dd>${guide.annotations.length}</dd></div></dl>${priorStudiesHtml?`<div class="guide-prior-studies"><span class="mini-label">Prior studies overlapping this passage</span>${priorStudiesHtml}</div>`:''}${guide.literaryContext.length?`<div class="literary-context"><span class="mini-label">Literary context</span>${guide.literaryContext.map((section)=>`<button type="button" class="context-section ${section.role}" data-reference="${escapeHtml(formatPassage(section.passage))}"><span>${section.role}</span><strong>${escapeHtml(section.heading)}</strong><small>${escapeHtml(formatPassage(section.passage))}</small></button>`).join('')}</div>`:''}${guide.sections.length?`<div class="passage-sections"><span class="mini-label">Headings inside selection</span>${guide.sections.map((section)=>`<button type="button" class="section-jump" data-verse="${section.verse}"><span>v.${section.verse}</span>${escapeHtml(section.heading)}</button>`).join('')}</div>`:''}</section>
      <section class="panel-section"><div class="section-heading-row"><h3>Your structure</h3><button class="text-button" id="guideOutlineBtn" type="button">${outline?.sections.length?'Edit outline':'Outline passage'}</button></div>${outlineHtml}</section>
      <section class="panel-section"><div class="section-heading-row"><h3>Your questions</h3>${questions.length?`<span class="question-count">${questions.length}</span>`:''}</div>${questionsHtml}</section>
      <section class="panel-section"><h3>Repeated signals</h3><div class="metric-row">${guide.patterns.slice(0,8).map((p)=>`<span class="metric">${escapeHtml(p.label)} × ${p.count}</span>`).join('')||'<span class="quiet">No repeated signals in the current selection.</span>'}</div></section>
      <section class="panel-section"><h3>Discourse markers</h3><div class="metric-row">${guide.structuralMarkers.slice(0,12).map((marker)=>`<span class="metric">${escapeHtml(marker.label)} · ${escapeHtml(marker.category.replace('purpose-result','purpose/result'))}</span>`).join('')||'<span class="quiet">No explicit discourse markers detected in this selection.</span>'}</div><p class="quiet">These are textual signals in the English translation, not automatic interpretations of the argument.</p></section>
      <section class="panel-section"><h3>Cross-references</h3><div>${guide.crossReferences.slice(0,8).map(referenceButtonHtml).join('')||'<p class="quiet">No outgoing references available.</p>'}</div></section>
      <section class="panel-section"><h3>Referenced by</h3><div>${guide.backlinks.slice(0,8).map(backlinkButtonHtml).join('')||'<p class="quiet">No incoming references are indexed for this passage.</p>'}</div></section>
      <section class="panel-section"><h3>Important words</h3><div class="lexical-guide-list">${guide.importantLexicalItems.map((item)=>{const entry=item.entry;const title=entry?.lemma||item.strongs;const detail=[entry?.transliteration,entry?.gloss,item.strongs,`× ${item.count}`].filter(Boolean).join(' · ');return `<button class="reference-card lexical-key" type="button" data-strongs="${escapeHtml(item.strongs)}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></button>`;}).join('')||'<p class="quiet">No lexical alignment is available for this selection.</p>'}</div></section>
      <section class="panel-section"><h3>Resources</h3>${guide.resources.map(({resource,url})=>resourceLinkHtml(resource,url)).join('')}</section>
    </section>`;
    wireReferenceButtons(); wirePersonalStudyReferences(elements.studyContent); wireLexicalButtons(); wireSectionJumps();
    $('#guideLiteraryMode')?.addEventListener('change',async(event)=>{
      const value=event.target.value;
      if(value==='auto'&&!currentStudy){await renderGuide();return;}
      const study=currentStudy??await ensureStudy();
      currentStudy=await studyService.setLiteraryMode(study.id,value==='auto'?undefined:value);
      await renderGuide();
    });
    $('#guideOutlineBtn')?.addEventListener('click',async()=>{activeTab='outline';await renderActiveTab();});
    queryAll('[data-open-study-questions]').forEach((button)=>button.addEventListener('click',async()=>{activeTab='notes';await renderActiveTab();}));
    queryAll('[data-observation-focus]').forEach((button)=>button.addEventListener('click',async()=>{
      const prompt=guide.observationPrompts[Number(button.dataset.observationFocus)];
      if(!prompt)return;
      const clearing=focusedObservationPromptId===prompt.id;
      focusedObservationPromptId=clearing?undefined:prompt.id;
      patternTokenIds.clear();
      if(!clearing)for(const tokenId of prompt.tokenIds)patternTokenIds.add(tokenId);
      await renderScripture();
      if(!clearing&&prompt.tokenIds[0])document.querySelector(`[data-token-id="${CSS.escape(prompt.tokenIds[0])}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});
      toast(clearing?'Observation focus cleared.':'Textual cue highlighted.');
    }));
    queryAll('[data-observation-save]').forEach((button)=>button.addEventListener('click',async()=>{
      const prompt=guide.observationPrompts[Number(button.dataset.observationSave)];
      if(!prompt)return;
      const study=await ensureStudy();
      const existing=await annotationService.forPassage(currentScripture.passage,currentScripture.translationId,study.id);
      if(existing.some((annotation)=>annotation.kind==='question'&&annotation.body?.trim()===prompt.prompt.trim())){toast('Question already saved.');return;}
      await annotationService.createQuestion(currentScripture.passage,prompt.prompt,study.id);
      await studyService.touch(study.id);
      toast('Observation question saved.');
      await renderGuide();
    }));
  } catch (error) { renderToolError('Guide unavailable',error); }
}
function referenceButtonHtml(ref,studies=[]) {
  const target=formatPassage(ref.target);
  return connectedReferenceCardHtml({label:target,detail:'Referenced from this passage',reference:target,studies});
}
function backlinkButtonHtml(ref,studies=[]) {
  const source=formatPassage(ref.source);
  return connectedReferenceCardHtml({label:source,detail:'Points to this passage',reference:source,studies});
}
const wirePersonalStudyReferences=(r=document)=>wireRef(r,openStudySnapshot);
function resourceLinkHtml(resource,url) { return `<a class="resource-link" href="${escapeHtml(url)}" target="_blank" rel="noopener"><span>${escapeHtml(resource.name)}</span><small>${escapeHtml(resource.category)} ↗</small></a>`; }
async function renderNotes() {
  const annotations = await annotationService.forPassage(currentScripture.passage,currentScripture.translationId,currentStudy?.id);
  const document = currentStudy ? await repo.getStudyDocument(currentStudy.id) : undefined;
  const draft=readStudyDraft(currentScripture.passage);
  const recoveredDraft=Boolean(draft&&draft.updatedAt>(document?.updatedAt??0));
  const documentText=recoveredDraft?draft.value:(document?.plainText??'');
  if(recoveredDraft)elements.saveState.textContent='recovered unsaved draft';
  const links=extractStudyDocumentScriptureLinks(documentText);
  const linkedHtml=links.length?`<section class="panel-section linked-scripture"><h3>Linked Scripture</h3><div class="metric-row">${links.map((link)=>`<button class="metric" type="button" data-reference="${escapeHtml(formatPassage(link.passage))}">${escapeHtml(link.label)}</button>`).join('')}</div><p class="quiet">Type references as <code>[[Romans 8:1-4]]</code>. Links remain ordinary plaintext and open as Peeks.</p></section>`:'';
  elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">STUDY DOCUMENT</span><h2>${escapeHtml(formatPassage(currentScripture.passage))}</h2><p class="panel-lede">Capture freeform observations, questions, context, and connections here; keep final conclusions in Synthesis.</p>
    <section class="panel-section"><h3>Anchored material</h3><div class="annotation-list">${annotations.map(annotationHtml).join('')||'<p class="quiet">Select Scripture and add a note, question, or highlight.</p>'}</div></section>
    <textarea class="study-document" id="studyDocument" placeholder="Observations\n\nQuestions\n\nContext\n\nConnections\n\nUnresolved issues">${escapeHtml(documentText)}</textarea>${linkedHtml}</section>`;
  $('#studyDocument').addEventListener('input',(event)=>{scheduleDocumentSave(event.target.value);renderStudyDocumentLinks(event.target.value);});
  wireAnnotationActions(); wireReferenceButtons();
}
function annotationHtml(annotation) {
  const anchor = annotation.anchor.type==='reference' ? formatPassage(annotation.anchor.passage) : (annotation.anchor.type==='text'||annotation.anchor.type==='text-range') ? annotation.anchor.quotedText : 'original-language token';
  const body = annotation.body || (annotation.kind==='highlight' ? `Highlight (${annotation.highlightStyle??'default'})` : '');
  const editable=annotation.kind!=='highlight';
  const response=annotation.kind==='question'&&annotation.response?.trim()
    ? `<div class="question-response"><span>Response</span><p>${escapeHtml(annotation.response.trim())}</p></div>`
    : '';
  const questionAction=annotation.kind==='question'
    ? `<button type="button" data-annotation-action="answer">${annotation.response?.trim()?'Edit response':'Answer'}</button>`
    : '';
  return `<article class="annotation-item ${annotation.kind==='question'?'question-item':''}" data-annotation-id="${escapeHtml(annotation.id)}"><div class="annotation-heading"><div><span class="annotation-kind">${escapeHtml(annotation.kind)}</span><span class="annotation-anchor">${escapeHtml(anchor)}</span></div><div class="annotation-actions">${editable?'<button type="button" data-annotation-action="edit-body">Edit</button>':''}${questionAction}<button type="button" data-annotation-action="delete">Delete</button></div></div>${body?`<p>${escapeHtml(body)}</p>`:''}${response}</article>`;
}
function renderStudyDocumentLinks(text) {
  const links=extractStudyDocumentScriptureLinks(text);
  let section=$('.linked-scripture');
  if(!links.length){section?.remove();return;}
  const html=`<h3>Linked Scripture</h3><div class="metric-row">${links.map((link)=>`<button class="metric" type="button" data-reference="${escapeHtml(formatPassage(link.passage))}">${escapeHtml(link.label)}</button>`).join('')}</div><p class="quiet">Type references as <code>[[Romans 8:1-4]]</code>. Links remain ordinary plaintext and open as Peeks.</p>`;
  if(!section){section=document.createElement('section');section.className='panel-section linked-scripture';$('#studyDocument').insertAdjacentElement('afterend',section);}
  section.innerHTML=html; wireReferenceButtons();
}
async function openAnnotationEditor(annotation,field) {
  editingAnnotationId=annotation.id;
  editingAnnotationField=field;
  $('#noteDialogTitle').textContent=field==='response'?'Answer question':annotation.kind==='question'?'Edit question':'Edit note';
  elements.noteAnchorLabel.textContent=field==='response'?(annotation.body??'Question'):annotation.anchor.type==='reference'?formatPassage(annotation.anchor.passage):(annotation.anchor.type==='text'||annotation.anchor.type==='text-range')?annotation.anchor.quotedText:'Annotation';
  elements.noteBody.value=field==='response'?(annotation.response??''):(annotation.body??'');
  elements.noteDialog.showModal();
  await sleep(0);
  elements.noteBody.focus();
}
function wireAnnotationActions() {
  queryAll('[data-annotation-action]').forEach((button)=>button.addEventListener('click',async()=>{
    const item=button.closest('[data-annotation-id]'); const id=item?.dataset.annotationId; if(!id)return;
    const action=button.dataset.annotationAction;
    if(action==='edit-body'||action==='answer'){
      const annotation=(await repo.listAnnotations()).find((x)=>x.id===id); if(!annotation)return;
      await openAnnotationEditor(annotation,action==='answer'?'response':'body');
    }
    if(action==='delete'){
      if(!confirm('Delete this anchored annotation?'))return;
      await annotationService.remove(id); await currentStudy&&studyService.touch(currentStudy.id); await renderScripture(); await renderNotes();
    }
  }));
}
function scheduleDocumentSave(value) {
  if(!currentScripture)return;
  const passage=structuredClone(currentScripture.passage);
  const studyIdAtEdit=currentStudy?.id;
  const draftRevision=writeStudyDraft(passage,value);
  setSaving(true);
  clearTimeout(noteSaveTimer);
  noteSaveTimer=setTimeout(async()=>{
    try {
      let study=studyIdAtEdit ? await repo.getStudy(studyIdAtEdit) : await getStudyForPassage(passage);
      if(!study)study=await studyService.create(passage);
      const updatedAt=Date.now();
      await repo.putStudyDocument({studyId:study.id,format:'plaintext',document:null,plainText:value,updatedAt});
      await studyService.touch(study.id);
      clearStudyDraft(passage,draftRevision);
      if(currentScripture&&samePassage(currentScripture.passage,passage)){
        currentStudy=study;
        if(workspace&&workspace.studyId!==study.id){
          workspace={...workspace,studyId:study.id,updatedAt};
          await repo.putWorkspace(workspace);
          await workspaceService.markLastOpened(workspace);
        }
        setSaving(false);
      }
    } catch {
      if(currentScripture&&samePassage(currentScripture.passage,passage))elements.saveState.textContent='unsaved draft preserved';
    }
  },300);
}
function outlineSectionHtml(section) {
  return `<article class="outline-section" data-outline-id="${escapeHtml(section.id)}"><label><span>Verses</span><input data-outline-field="reference" value="${escapeHtml(formatPassage(section.passage))}" aria-label="Outline section verses"></label><label class="outline-label"><span>Section</span><input data-outline-field="label" value="${escapeHtml(section.label)}" placeholder="What is happening here?" aria-label="Outline section label"></label><button class="icon-button outline-delete" data-outline-action="delete" type="button" aria-label="Delete outline section">×</button></article>`;
}
async function parseOutlineReference(raw) {
  const parsed=parseReference(raw);
  if(parsed.kind!=='passage')throw new Error('Outline sections need verse ranges, for example Philippians 2:5–8.');
  const bounds=await loadVerseBounds();
  bounds?.validatePassage(parsed.passage);
  return parsed.passage;
}
function outlineSectionsFromHeadings() {
  const verses=currentScripture?.verses??[];
  const headingIndexes=verses.map((verse,index)=>verse.heading?index:-1).filter((index)=>index>=0);
  if(!headingIndexes.length)return [];
  const boundaries=[0,...headingIndexes.filter((index)=>index>0)];
  return boundaries.map((startIndex,index)=>{
    const endIndex=(boundaries[index+1]??verses.length)-1;
    const startVerse=verses[startIndex];
    const endVerse=verses[endIndex];
    return {
      id:crypto.randomUUID(),
      passage:{start:structuredClone(startVerse.ref),end:structuredClone(endVerse.ref)},
      label:startVerse.heading??'',
    };
  });
}
async function saveOutlineSections(sections) {
  const study=await ensureStudy();
  setSaving(true);
  try {
    const outline=await outlineService.save(study,sections);
    currentStudy=await studyService.touch(study.id);
    const synthesis=await repo.getStudySynthesis(study.id);
    if(synthesis){
      const result=await reviewService.reconcileExisting(currentStudy,synthesis,outline);
      if(result.updated||result.deleted){
        await refreshReviewBadge();
        if(!elements.reviewDrawer.hidden)await renderReview();
      }
    }
    setSaving(false);
    return outline;
  } catch(error) {
    setSaving(false);
    throw error;
  }
}
async function collectOutlineRows() {
  const rows=queryAll('.outline-section');
  const sections=[];
  for(const row of rows) {
    const passage=await parseOutlineReference(row.querySelector('[data-outline-field="reference"]').value);
    sections.push({
      id:row.dataset.outlineId,
      passage,
      label:row.querySelector('[data-outline-field="label"]').value,
    });
  }
  return sections;
}
async function renderOutline() {
  const outline=currentStudy ? await outlineService.get(currentStudy.id) : undefined;
  const sections=outline?.sections??[];
  const hasHeadings=currentScripture.verses.some((verse)=>Boolean(verse.heading));
  const draftReference=outlineDraftPassage?formatPassage(outlineDraftPassage):'';
  elements.studyContent.innerHTML=`<section class="panel outline-panel"><span class="eyebrow">PASSAGE OUTLINE</span><h2>See the flow of ${escapeHtml(formatPassage(currentScripture.passage))}</h2><p class="panel-lede">Divide the passage into units and name what each unit contributes. This is your structure, not an automatic interpretation.</p>
    <div class="outline-list">${sections.map(outlineSectionHtml).join('')||'<p class="quiet outline-empty">No sections yet. Start with the divisions you see in the text.</p>'}</div>
    <section class="outline-add"><label><span>Verses</span><input id="outlineNewReference" value="${escapeHtml(draftReference)}" placeholder="${escapeHtml(formatPassage(currentScripture.passage))}"></label><label><span>Section</span><input id="outlineNewLabel" placeholder="Name this unit"></label><button class="primary-button" id="outlineAdd" type="button">Add section</button></section>
    ${hasHeadings?`<section class="outline-seed"><div><strong>Use BSB headings as a draft</strong><p>Translation headings are editorial aids, not part of the biblical text. Use them only as a starting point and change them freely.</p></div><button class="text-button" id="outlineSeed" type="button">Seed from headings</button></section>`:''}
  </section>`;
  queryAll('.outline-section input').forEach((input)=>input.addEventListener('change',async()=>{
    try {
      await saveOutlineSections(await collectOutlineRows());
      await renderOutline();
    } catch(error){toast(error instanceof Error?error.message:'Unable to save outline');}
  }));
  queryAll('[data-outline-action="delete"]').forEach((button)=>button.addEventListener('click',async()=>{
    button.closest('.outline-section')?.remove();
    try { await saveOutlineSections(await collectOutlineRows()); await renderOutline(); }
    catch(error){toast(error instanceof Error?error.message:'Unable to save outline');}
  }));
  $('#outlineAdd')?.addEventListener('click',async()=>{
    try {
      const passage=await parseOutlineReference($('#outlineNewReference').value.trim());
      const next=[...sections,{id:crypto.randomUUID(),passage,label:$('#outlineNewLabel').value.trim()}];
      await saveOutlineSections(next);
      outlineDraftPassage=undefined;
      await renderOutline();
    } catch(error){toast(error instanceof Error?error.message:'Unable to add outline section');}
  });
  $('#outlineNewReference')?.addEventListener('keydown',(event)=>{if(event.key==='Enter'){event.preventDefault();$('#outlineNewLabel').focus();}});
  $('#outlineNewLabel')?.addEventListener('keydown',(event)=>{if(event.key==='Enter'){event.preventDefault();$('#outlineAdd').click();}});
  $('#outlineSeed')?.addEventListener('click',async()=>{
    const seeded=outlineSectionsFromHeadings();
    if(!seeded.length){toast('No editorial headings are available in this selection.');return;}
    if(sections.length&&!confirm('Replace your current outline with a draft based on BSB headings?'))return;
    try { await saveOutlineSections(seeded); outlineDraftPassage=undefined; await renderOutline(); }
    catch(error){toast(error instanceof Error?error.message:'Unable to seed outline');}
  });
  if(outlineDraftPassage)requestAnimationFrame(()=>$('#outlineNewLabel')?.focus());
}
function emptySynthesis(studyId='') {
  return { studyId, mainIdea:'', explanation:'', evidence:'', application:'', prayer:'', confidence:'needs-study', updatedAt:0 };
}
function readSynthesisForm() {
  return {
    mainIdea:$('#synthesisMainIdea')?.value??'',
    explanation:$('#synthesisExplanation')?.value??'',
    evidence:$('#synthesisEvidence')?.value??'',
    application:$('#synthesisApplication')?.value??'',
    prayer:$('#synthesisPrayer')?.value??'',
    confidence:$('#synthesisConfidence')?.value??'needs-study',
  };
}
function synthesisHasContent(value) {
  return [value.mainIdea,value.explanation,value.evidence,value.application,value.prayer].some((item)=>item.trim());
}
async function renderSynthesis() {
  const [saved,outline,studyAnnotations,claims]=await Promise.all([
    currentStudy ? repo.getStudySynthesis(currentStudy.id) : Promise.resolve(undefined),
    currentStudy ? outlineService.get(currentStudy.id) : Promise.resolve(undefined),
    currentStudy ? annotationService.forPassage(currentScripture.passage,currentScripture.translationId,currentStudy.id) : Promise.resolve([]),
    currentStudy ? repo.listInterpretationClaims(currentStudy.id) : Promise.resolve([]),
  ]);
  const unresolvedQuestions=studyAnnotations.filter((annotation)=>annotation.kind==='question'&&!annotation.response?.trim());
  const synthesis=saved??emptySynthesis(currentStudy?.id);
  const structureSummary=outline?.sections.length
    ? `<section class="synthesis-structure"><div class="section-heading-row"><span class="mini-label">PASSAGE STRUCTURE</span><button class="text-button" id="synthesisOutlineBtn" type="button">Edit outline</button></div>${outline.sections.map((section)=>`<div><span>${escapeHtml(formatPassage(section.passage))}</span><strong>${escapeHtml(section.label||'Untitled section')}</strong></div>`).join('')}</section>`
    : `<section class="synthesis-structure empty"><span class="mini-label">PASSAGE STRUCTURE</span><p>No outline yet. Structure the passage before finalizing its main idea if that would help.</p><button class="text-button" id="synthesisOutlineBtn" type="button">Outline passage</button></section>`;
  const unresolvedHtml=unresolvedQuestions.length
    ? `<section class="synthesis-unresolved"><div><span class="mini-label">UNRESOLVED QUESTIONS · ${unresolvedQuestions.length}</span>${unresolvedQuestions.slice(0,4).map((question)=>`<p>${escapeHtml(question.body??'Question')}</p>`).join('')}</div><button class="text-button" id="synthesisQuestionsBtn" type="button">Open in Notes</button></section>`
    : '';
  elements.studyContent.innerHTML=`<section class="panel synthesis-panel"><span class="eyebrow">SYNTHESIS</span><h2>${escapeHtml(formatPassage(currentScripture.passage))}</h2><p class="panel-lede">State what the passage means after observation and investigation. Keep conclusions tied to textual evidence.</p>${structureSummary}${claimsSummaryHtml(claims)}${unresolvedHtml}
    <label class="synthesis-field synthesis-main"><span>Main idea</span><small>One sentence: what is the author saying here?</small><textarea id="synthesisMainIdea" rows="2" placeholder="The main point of this passage is…">${escapeHtml(synthesis.mainIdea)}</textarea></label>
    <label class="synthesis-field"><span>Explain it</span><small>Explain the passage in your own words as if teaching someone else.</small><textarea id="synthesisExplanation" rows="7" placeholder="In context, the author is arguing…">${escapeHtml(synthesis.explanation)}</textarea></label>
    <label class="synthesis-field"><span>Evidence summary <em>optional</em></span><small>Claims above hold the precise references. Summarize only the decisive evidence you want in the final synthesis.</small><textarea id="synthesisEvidence" rows="4" placeholder="The decisive evidence is…">${escapeHtml(synthesis.evidence)}</textarea></label>
    <label class="synthesis-field synthesis-confidence"><span>Interpretation confidence</span><select id="synthesisConfidence">
      <option value="clear"${synthesis.confidence==='clear'?' selected':''}>Clear from text</option>
      <option value="strong-inference"${synthesis.confidence==='strong-inference'?' selected':''}>Strong inference</option>
      <option value="tentative"${synthesis.confidence==='tentative'?' selected':''}>Tentative</option>
      <option value="needs-study"${synthesis.confidence==='needs-study'?' selected':''}>Need more study</option>
    </select></label>
    <label class="synthesis-field"><span>Application</span><small>Because this passage is true, what should you believe, do, stop, trust, or remember?</small><textarea id="synthesisApplication" rows="4" placeholder="Because this is true…">${escapeHtml(synthesis.application)}</textarea></label>
    <label class="synthesis-field"><span>Prayer</span><small>Turn what you learned into prayer.</small><textarea id="synthesisPrayer" rows="4" placeholder="Lord…">${escapeHtml(synthesis.prayer)}</textarea></label>
    <section class="synthesis-review-action"><div><strong>Remember what you learned</strong><p>Create review cards from your main idea, explanation, evidence, and application. Add custom questions for specific details or argument links you want to retrieve later. Prayer stays prayer.</p></div><div class="synthesis-review-buttons"><button class="text-button" id="addCustomReviewCard" type="button">Add custom card</button><button class="primary-button" id="syncReviewCards" type="button">Create / update derived cards</button></div></section>
  </section>`;
  queryAll('.synthesis-field textarea').forEach((field)=>field.addEventListener('input',()=>scheduleSynthesisSave(readSynthesisForm())));
  $('#synthesisConfidence')?.addEventListener('change',()=>scheduleSynthesisSave(readSynthesisForm(),0));
  $('#synthesisOutlineBtn')?.addEventListener('click',async()=>{activeTab='outline';await renderActiveTab();});
  $('#synthesisClaimsBtn')?.addEventListener('click',()=>$('#tab-claims').click());
  $('#synthesisQuestionsBtn')?.addEventListener('click',async()=>{activeTab='notes';await renderActiveTab();});
  $('#addCustomReviewCard')?.addEventListener('click',async()=>{const study=await ensureStudy();await openReviewCardEditor(study.id);});
  $('#syncReviewCards')?.addEventListener('click',async()=>{
    const value=readSynthesisForm();
    if(!synthesisHasContent(value)){toast('Write your synthesis before creating review cards.');return;}
    clearTimeout(synthesisSaveTimer);
    const saved=await persistSynthesis(value,structuredClone(currentScripture.passage),currentStudy?.id);
    if(!saved)return;
    const result=await reviewService.syncFromSynthesis(saved.study,saved.synthesis,await outlineService.get(saved.study.id));
    await refreshReviewBadge();
    toast(result.created||result.updated||result.deleted?`${result.created} created · ${result.updated} updated · ${result.deleted} removed`:'Review cards are already up to date.');
  });
}
async function reconcileReviewCardsNow(study,synthesis,outline=undefined) {
  const resolvedOutline=outline??await outlineService.get(study.id);
  const result=await reviewService.reconcileExisting(study,synthesis,resolvedOutline);
  if(result.updated||result.deleted){
    await refreshReviewBadge();
    if(!elements.reviewDrawer.hidden)await renderReview();
  }
  return result;
}
function scheduleReviewReconcile(study,synthesis,delay=750) {
  clearTimeout(reviewReconcileTimer);
  reviewReconcileTimer=setTimeout(()=>reconcileReviewCardsNow(study,synthesis).catch(()=>{}),delay);
}
async function persistSynthesis(value,passage,studyIdAtEdit) {
  try {
    if(!synthesisHasContent(value)&&!studyIdAtEdit) { setSaving(false); return undefined; }
    let study=studyIdAtEdit ? await repo.getStudy(studyIdAtEdit) : await getStudyForPassage(passage);
    if(!study)study=await studyService.create(passage);
    const updatedAt=Date.now();
    const synthesis={studyId:study.id,...value,updatedAt};
    await repo.putStudySynthesis(synthesis);
    study=await studyService.touch(study.id);
    scheduleReviewReconcile(study,synthesis);
    if(currentScripture&&samePassage(currentScripture.passage,passage)){
      currentStudy=study;
      if(workspace&&workspace.studyId!==study.id){
        workspace={...workspace,studyId:study.id,updatedAt};
        await repo.putWorkspace(workspace);
        await workspaceService.markLastOpened(workspace);
      }
      setSaving(false);
    }
    return {study,synthesis};
  } catch {
    if(currentScripture&&samePassage(currentScripture.passage,passage))elements.saveState.textContent='synthesis not saved';
    return undefined;
  }
}
function scheduleSynthesisSave(value,delay=250) {
  if(!currentScripture)return;
  const passage=structuredClone(currentScripture.passage);
  const studyIdAtEdit=currentStudy?.id;
  setSaving(true);
  clearTimeout(synthesisSaveTimer);
  synthesisSaveTimer=setTimeout(()=>persistSynthesis(value,passage,studyIdAtEdit),delay);
}
async function renderReferences() {
  elements.studyContent.innerHTML='<div class="loading">Loading references…</div>';
  try {
    const [refs,backlinks,studies]=await Promise.all([researchProvider.forPassage(currentScripture.passage),researchProvider.backlinksForPassage(currentScripture.passage),repo.listStudies()]);
    elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">SCRIPTURE CONNECTIONS</span><h2>${escapeHtml(formatPassage(currentScripture.passage))}</h2><p class="panel-lede">Explore both directions of the reference network while the primary passage stays fixed. Selah also surfaces related passages you have already studied.</p><section class="panel-section"><h3>From this passage</h3><div>${refs.map((ref)=>referenceButtonHtml(ref,studiesOverlappingPassage(studies,ref.target))).join('')||'<p class="quiet">No outgoing references available.</p>'}</div></section><section class="panel-section"><h3>Referenced by</h3><div>${backlinks.map((ref)=>backlinkButtonHtml(ref,studiesOverlappingPassage(studies,ref.source))).join('')||'<p class="quiet">No incoming references are indexed for this passage.</p>'}</div></section></section>`;
    wireReferenceButtons(); wirePersonalStudyReferences();
  } catch(error){ renderToolError('References unavailable',error); }
}
async function renderWords() {
  const strongs = selectedToken?.strongs ?? selectedLexicalKey;
  if (!strongs) {
    elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">WORD STUDY</span><h2>Select an aligned word</h2><p class="panel-lede">Select an aligned word in Scripture or an important lexical item from the Guide. Selah shows lexical, morphology, and concordance evidence without treating a gloss as the meaning of the whole verse.</p></section>`;
    return;
  }
  elements.studyContent.innerHTML='<div class="loading">Loading original-language data…</div>';
  try {
    const passageAnalyses=(await Promise.all(currentScripture.verses.map((verse)=>originalLanguage.analyzeVerse(verse.ref)))).flat();
    const analyses=passageAnalyses.filter((x)=>x.token.strongs===strongs);
    const lex=await researchProvider.get(strongs);
    const first=analyses[0];
    const heading=selectedToken?.text.trim() || lex?.lemma || strongs;
    const occurrences=first?.occurrences ?? await researchProvider.versesForStrongs(strongs);
    const occurrenceHtml=occurrences.length
      ? occurrences.slice(0,24).map((ref)=>`<button class="metric occurrence-ref" type="button" data-reference="${escapeHtml(formatPassage({start:ref,end:ref}))}">${escapeHtml(formatPassage({start:ref,end:ref}))}</button>`).join('')
      : '<span class="quiet">No concordance occurrences are installed.</span>';
    elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">WORD STUDY · ${escapeHtml(strongs)}</span><h2>${escapeHtml(heading)}</h2><p class="panel-lede">Original-language evidence connected to this passage.</p>${analyses.map((a)=>`<section class="panel-section"><div class="word-lemma">${escapeHtml(a.morphology?.lemma||a.lexicon?.lemma||a.token.text)}</div><div class="word-translit">${escapeHtml(a.lexicon?.transliteration||'')} ${escapeHtml(a.morphology?.partOfSpeech||'')}</div><div class="metric-row">${a.morphology?.morphology?`<span class="metric">${escapeHtml(a.morphology.morphology)}</span>`:''}${a.occurrenceCount!==undefined?`<span class="metric">${a.occurrenceCount} verse occurrences</span>`:''}<span class="metric">${escapeHtml(formatPassage({start:a.ref,end:a.ref}))}</span></div></section>`).join('')||'<p class="quiet">This key is present in the research index but has no aligned token in the current passage.</p>'}${lex?`<section class="panel-section"><h3>Lexicon</h3><p class="word-definition"><strong>${escapeHtml(lex.gloss||'')}</strong>${lex.definition?` — ${escapeHtml(lex.definition)}`:''}</p></section>`:''}<section class="panel-section"><h3>Occurrences</h3><div class="metric-row occurrence-list">${occurrenceHtml}</div>${occurrences.length>24?`<p class="quiet">Showing the first 24 of ${occurrences.length} verse occurrences.</p>`:''}</section><p class="warning">Lexical data describes possible usage. Meaning is determined by this sentence, argument, genre, and broader context—not by a dictionary gloss alone.</p></section>`;
    wireReferenceButtons();
  } catch(error){ renderToolError('Word study unavailable',error); }
}
async function renderCompare() {
  elements.studyContent.innerHTML=await comparisonPanelHtml(translations,currentScripture.passage);
}
function defaultPhrasingDocument(study) {
  return { id:crypto.randomUUID(),studyId:study.id,passage:structuredClone(currentScripture.passage),roots:currentScripture.verses.map((verse)=>({id:crypto.randomUUID(),tokenIds:verse.tokens.map((t)=>t.id),label:`v.${verse.ref.verse}`,children:[]})),updatedAt:Date.now() };
}
function phraseText(node){return node.tokenIds.map((id)=>tokenById(id)?.text??'').join('');}
function phraseSplitHtml(node){
  if(phrasingSplitNodeId!==node.id || node.children.length || node.tokenIds.length<2) return `<div class="phrase-text">${escapeHtml(phraseText(node))}</div>`;
  return `<div class="phrase-text phrase-split-mode">${node.tokenIds.map((id,index)=>{const token=tokenById(id);const marker=index<node.tokenIds.length-1?`<button class="phrase-split-marker" data-phrase-action="split-after" data-id="${node.id}" data-token-id="${escapeHtml(id)}" type="button" title="Split here" aria-label="Split phrase after ${escapeHtml(token?.text??'token')}">│</button>`:'';return `<span>${escapeHtml(token?.text??'')}</span>${marker}`;}).join('')}</div>`;
}
function phraseNodeHtml(node,depth=0){return `<div class="phrase-node" style="margin-left:${Math.min(depth,5)*14}px" data-phrase-id="${node.id}"><input class="phrase-label" data-label-id="${node.id}" value="${escapeHtml(node.label??'')}" placeholder="Label">${phraseSplitHtml(node)}<div class="phrase-toolbar"><button data-phrase-action="split-mode" data-id="${node.id}" type="button">${phrasingSplitNodeId===node.id?'Cancel split':'Split'}</button><button data-phrase-action="merge-prev" data-id="${node.id}" type="button">Merge ↑</button><button data-phrase-action="indent" data-id="${node.id}" type="button">Indent</button><button data-phrase-action="outdent" data-id="${node.id}" type="button">Outdent</button></div>${node.children.map((x)=>phraseNodeHtml(x,depth+1)).join('')}</div>`;}
async function renderPhrasing() {
  if (currentStudy) phrasingDocument=(await repo.listPhrasingDocuments(currentStudy.id)).find((x)=>samePassage(x.passage,currentScripture.passage));
  elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">PHRASING</span><h2>See the argument</h2><p class="panel-lede">Indent clauses or verse units to make relationships visible. This structure is your analysis; Scripture tokens themselves are never modified.</p>${phrasingDocument?`<div class="phrase-tree">${phrasingDocument.roots.map((x)=>phraseNodeHtml(x)).join('')}</div>`:'<button class="primary-button" id="startPhrasing" type="button">Start phrasing this passage</button>'}</section>`;
  $('#startPhrasing')?.addEventListener('click',async()=>{const study=await ensureStudy(); phrasingDocument=defaultPhrasingDocument(study); await repo.putPhrasingDocument(phrasingDocument); await renderPhrasing();});
  queryAll('[data-phrase-action]').forEach((button)=>button.addEventListener('click',async()=>{
    if(!phrasingDocument)return;
    const id=button.dataset.id; const action=button.dataset.phraseAction;
    if(action==='split-mode'){phrasingSplitNodeId=phrasingSplitNodeId===id?undefined:id;await renderPhrasing();return;}
    let roots=phrasingDocument.roots;
    if(action==='split-after'){roots=splitPhraseNode(roots,id,button.dataset.tokenId,crypto.randomUUID());phrasingSplitNodeId=undefined;}
    else if(action==='merge-prev') roots=mergePhraseWithPrevious(roots,id);
    else if(action==='indent') roots=indentPhrase(roots,id);
    else if(action==='outdent') roots=outdentPhrase(roots,id);
    phrasingDocument={...phrasingDocument,roots,updatedAt:Date.now()}; await repo.putPhrasingDocument(phrasingDocument); await renderPhrasing();
  }));
  queryAll('[data-label-id]').forEach((input)=>input.addEventListener('change',async()=>{if(!phrasingDocument)return;phrasingDocument={...phrasingDocument,roots:updatePhraseNode(phrasingDocument.roots,input.dataset.labelId,{label:input.value}),updatedAt:Date.now()};await repo.putPhrasingDocument(phrasingDocument);}));
}
async function renderResources() {
  const guide=await guideService.build(currentScripture);
  elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">EXTERNAL RESOURCES</span><h2>${escapeHtml(formatPassage(currentScripture.passage))}</h2><p class="panel-lede">Open external tools deliberately. Selah keeps commentary secondary to your own observation.</p>${guide.resources.map(({resource,url})=>resourceLinkHtml(resource,url)).join('')}<section class="resource-attribution"><h3>Data & licenses</h3><a class="resource-link" href="./data/bsb/ATTRIBUTION.md" target="_blank" rel="noopener noreferrer"><span><strong>Bundled Scripture & research data</strong><small>View source attribution and licenses</small></span><span aria-hidden="true">↗</span></a></section></section>`;
}
async function renderActiveTab() {
  queryAll('.tab').forEach((tab)=>{
    const active=tab.dataset.tab===activeTab;
    tab.classList.toggle('active',active);
    tab.setAttribute('aria-selected',String(active));
    tab.tabIndex=active?0:-1;
  });
  elements.studyContent.setAttribute('aria-labelledby',`tab-${activeTab}`);
  if(!currentScripture)return;
  if(activeTab==='guide')return renderGuide();
  if(activeTab==='notes')return renderNotes();
  if(activeTab==='outline')return renderOutline();
  if(activeTab==='synthesis')return renderSynthesis();
  if(activeTab==='claims')return claimsUI(elements.studyContent,repo,studyService,currentStudy,currentScripture,ensureStudy,toast,resolveReferenceInput,openPeek);
  if(activeTab==='references')return renderReferences();
  if(activeTab==='words')return renderWords();
  if(activeTab==='compare')return renderCompare();
  if(activeTab==='phrasing')return renderPhrasing();
  if(activeTab==='resources')return renderResources();
}
function renderToolError(title,error){elements.studyContent.innerHTML=`<div class="error-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(error instanceof Error?error.message:String(error))}</div>`;}
function wireReferenceButtons(root=document){[...root.querySelectorAll('[data-reference]')].forEach((button)=>button.addEventListener('click',()=>openPeek(parseReference(button.dataset.reference).passage)));}
function wireLexicalButtons(){queryAll('.lexical-key').forEach((button)=>button.addEventListener('click',async()=>{selectedLexicalKey=button.dataset.strongs;selectedToken=undefined;activeTab='words';await renderActiveTab();}));}
function wireSectionJumps(){queryAll('.section-jump').forEach((button)=>button.addEventListener('click',()=>{$(`.verse[data-book="${currentScripture.passage.start.book}"][data-chapter="${currentScripture.passage.start.chapter}"][data-verse="${button.dataset.verse}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});}));}
async function openPeek(passage) {
  activePeekPassage=passage; elements.peekTitle.textContent=formatPassage(passage); peekCtl.open(document.activeElement); elements.peekText.textContent='Loading…';
  try {
    const scripture=await scriptureProvider.getPassage(passage);
    const [refs,backlinks,studies]=await Promise.all([researchProvider.forPassage(passage),researchProvider.backlinksForPassage(passage),repo.listStudies()]);
    const text=scripture.verses.map((v)=>`<p class="peek-verse"><sup>${v.ref.verse}</sup> ${escapeHtml(v.tokens.map((t)=>t.text).join(''))}</p>`).join('');
    const priorStudies=studiesOverlappingPassage(studies,passage);
    const studied=personalStudyLinksHtml(Array.isArray(priorStudies)?priorStudies:[],formatPassage(passage));
    const outgoing=refs.slice(0,6).map((ref)=>referenceButtonHtml(ref,studiesOverlappingPassage(studies,ref.target))).join('');
    const incoming=backlinks.slice(0,6).map((ref)=>backlinkButtonHtml(ref,studiesOverlappingPassage(studies,ref.source))).join('');
    elements.peekText.innerHTML=`${studied?`<section class="peek-prior-studies"><h4>Prior studies</h4>${studied}</section>`:'' }<div class="peek-scripture">${text}</div>${outgoing||incoming?`<div class="peek-connections">${outgoing?`<section><h4>From here</h4>${outgoing}</section>`:''}${incoming?`<section><h4>Referenced by</h4>${incoming}</section>`:''}</div>`:''}`;
    wireReferenceButtons(elements.peekText); wirePersonalStudyReferences(elements.peekText);
  }
  catch { elements.peekText.textContent='This reference is unavailable in the current Scripture dataset.'; }
}
async function navigateResearch(passage) {
  try { workspace=await workspaceService.navigate(workspace,passage); await setCurrentScripture(await scriptureProvider.getPassage(passage)); }
  catch(error){toast(error instanceof Error?error.message:'Unable to open passage');}
}
function updateHistoryButtons(){ if(!workspace){$('#backBtn').disabled=true;$('#forwardBtn').disabled=true;return;} $('#backBtn').disabled=workspace.researchTrail.index<=0; $('#forwardBtn').disabled=workspace.researchTrail.index>=workspace.researchTrail.entries.length-1; }
function adjacentChapter(direction) {
  if (!currentScripture) return undefined;
  const currentBook=BOOK_BY_ID.get(currentScripture.passage.start.book);
  if(!currentBook)return undefined;
  let book=currentBook; let chapter=currentScripture.passage.start.chapter+direction;
  if(chapter<1){book=BOOKS[currentBook.order-2];if(!book)return undefined;chapter=book.chapters;}
  else if(chapter>currentBook.chapters){book=BOOKS[currentBook.order];if(!book)return undefined;chapter=1;}
  return {book:book.id,chapter};
}
function updateChapterButtons(){
  $('#prevChapterBtn').disabled=!adjacentChapter(-1);
  $('#nextChapterBtn').disabled=!adjacentChapter(1);
}
async function openAdjacentChapter(direction){
  const target=adjacentChapter(direction);if(!target)return;
  try{const verses=await scriptureProvider.getChapter(target.book,target.chapter);if(!verses.length)throw new Error('Chapter is unavailable');await switchPrimaryPassage({translationId:scriptureProvider.translation.id,passage:{start:verses[0].ref,end:verses.at(-1).ref},verses});}
  catch(error){toast(error instanceof Error?error.message:'Unable to open chapter');}
}
async function refreshReviewBadge() {
  const due=await reviewService.due();
  const badge=$('#reviewDueCount');
  if(!badge)return;
  badge.textContent=String(due.length);
  badge.hidden=due.length===0;
  $('#reviewBtn')?.setAttribute('aria-label',due.length?`Review, ${due.length} card${due.length===1?'':'s'} due`:'Review, nothing due');
}
function reviewSourceLabel(source) {
  return {
    'main-idea':'Main idea',
    outline:'Passage structure',
    explanation:'Explain it',
    evidence:'Textual evidence',
    application:'Application',
    custom:'Custom question',
  }[source]??'Study recall';
}
async function openReviewCardEditor(studyId,card=undefined) {
  reviewCardStudyId=studyId;
  editingReviewCardId=card?.id;
  $('#reviewCardDialogTitle').textContent=card?'Edit custom review card':'Add custom review card';
  $('#reviewCardQuestion').value=card?.prompt??'';
  $('#reviewCardAnswer').value=card?.answer??'';
  $('#reviewCardDialog').showModal();
  await sleep(0);
  $('#reviewCardQuestion').focus();
}
async function renderReview(studyId=reviewStudyFilter) {
  const due=studyId?await reviewService.dueForStudy(studyId):await reviewService.due();
  if(!due.length) {
    const upcoming=(await repo.listReviewCards(studyId)).sort((a,b)=>a.dueAt-b.dueAt)[0];
    const next=upcoming?new Date(upcoming.dueAt).toLocaleString():undefined;
    const scopedStudy=studyId?await repo.getStudy(studyId):undefined;
    elements.reviewContent.innerHTML=`<section class="review-empty"><span class="eyebrow">REVIEW</span><h2>Nothing due${scopedStudy?' for this study':''}</h2><p>${next?`Next review: ${escapeHtml(next)}.`:'Create review cards from a passage Synthesis when you want to remember it long-term.'}</p></section>`;
    return;
  }
  const card=due[0];
  const study=await repo.getStudy(card.studyId);
  elements.reviewContent.innerHTML=`<section class="review-session" data-review-card="${escapeHtml(card.id)}"><div class="review-progress">${due.length} due${studyId?' in this study':''}</div><span class="eyebrow">${study?escapeHtml(formatPassage(study.primaryPassage)):'STUDY REVIEW'}</span><span class="review-source">${escapeHtml(reviewSourceLabel(card.source))}</span><h2>${escapeHtml(card.prompt)}</h2><button class="primary-button review-reveal" id="reviewReveal" type="button">Show answer</button><div class="review-answer" id="reviewAnswer" hidden><p>${escapeHtml(card.answer)}</p><div class="review-ratings"><button type="button" data-review-rating="forgot">Forgot</button><button type="button" data-review-rating="difficult">Difficult</button><button type="button" data-review-rating="good">Good</button></div><div class="review-answer-actions"><div>${study?'<button class="text-button" id="reviewOpenStudy" type="button">Open study</button>':''}${card.source==='custom'?'<button class="text-button" id="reviewEditCard" type="button">Edit card</button>':''}</div><button class="text-button review-delete" id="reviewDelete" type="button">Delete card</button></div></div></section>`;
  $('#reviewReveal')?.addEventListener('click',(event)=>{event.currentTarget.hidden=true;$('#reviewAnswer').hidden=false;});
  queryAll('[data-review-rating]').forEach((button)=>button.addEventListener('click',async()=>{await reviewService.rate(card.id,button.dataset.reviewRating);await refreshReviewBadge();await renderReview(studyId);}));
  $('#reviewOpenStudy')?.addEventListener('click',async()=>{if(!study)return;reviewDrawerCtl.close(false);reviewStudyFilter=undefined;await openStudyById(study.id);});
  $('#reviewEditCard')?.addEventListener('click',async()=>{if(!study||card.source!=='custom')return;await openReviewCardEditor(study.id,card);});
  $('#reviewDelete')?.addEventListener('click',async()=>{if(!confirm('Delete this review card?'))return;await reviewService.remove(card.id);await refreshReviewBadge();await renderReview(studyId);});
}
async function persistBookUnderstanding(bookId,value){
  await bookSynthesisService.save(bookId,value);
  if(activeBookId===bookId)$('#bookOverviewSaveState').textContent='saved locally';
}
function scheduleBookUnderstandingSave(bookId,value){
  pendingBookUnderstandingSave={bookId,value};
  $('#bookOverviewSaveState').textContent='saving…';
  clearTimeout(bookOverviewSaveTimer);
  bookOverviewSaveTimer=setTimeout(async()=>{
    const pending=pendingBookUnderstandingSave; pendingBookUnderstandingSave=undefined;
    if(!pending)return;
    try{await persistBookUnderstanding(pending.bookId,pending.value);}catch{if(activeBookId===pending.bookId)$('#bookOverviewSaveState').textContent='not saved';}
  },350);
}
async function flushBookUnderstandingSave(){
  clearTimeout(bookOverviewSaveTimer);
  const pending=pendingBookUnderstandingSave; pendingBookUnderstandingSave=undefined;
  if(pending)await persistBookUnderstanding(pending.bookId,pending.value);
}
async function openBookOverview(bookId){
  const book=BOOK_BY_ID.get(bookId); if(!book)return;
  await flushBookUnderstandingSave().catch(()=>{});
  activeBookId=bookId;
  const overview=await bookSynthesisService.overview(bookId);
  $('#bookOverviewTitle').textContent=book.name;
  $('#bookUnderstanding').value=overview.understanding;
  $('#bookOverviewSaveState').textContent='saved locally';
  $('#bookOverviewContent').innerHTML=bookOverviewContentHtml(overview);
  queryAll('#bookOverviewContent [data-book-study-id]').forEach((button)=>button.addEventListener('click',async()=>{const id=button.dataset.bookStudyId;await flushBookUnderstandingSave().catch(()=>{});$('#bookOverviewDialog').close();await openStudyById(id);}));
  $('#bookOverviewDialog').showModal();
}
async function openStudyById(id,tab) {
  const study=await repo.getStudy(id);
  if(!study)return;
  currentStudy=study;
  if(tab)activeTab=tab;
  const existing=(await repo.listWorkspaces()).find((workspace)=>workspace.studyId===study.id);
  workspace=existing??await workspaceService.create(study.primaryPassage,'BSB',study.id);
  await workspaceService.markLastOpened(workspace);
  await setCurrentScripture(await scriptureProvider.getPassage(workspace.primaryPassage));
  studiesDrawerCtl.close(false);
}
async function openStudySnapshot(id) {
  const study=await repo.getStudy(id);
  if(!study)return;
  snapshotStudyId=id;
  const [synthesis,outline,annotations,cards,claims]=await Promise.all([
    repo.getStudySynthesis(id),
    repo.getStudyOutline(id),
    repo.listAnnotations(id),
    repo.listReviewCards(id),
    repo.listInterpretationClaims(id),
  ]);
  const questions=annotations.filter((annotation)=>annotation.kind==='question');
  const unresolved=questions.filter((question)=>!question.response?.trim());
  const due=cards.filter((card)=>card.dueAt<=Date.now());
  $('#studySnapshotTitle').textContent=study.title??formatPassage(study.primaryPassage);
  const reviewButton=$('#studySnapshotReview');
  reviewButton.hidden=due.length===0;
  reviewButton.textContent=due.length?`Review ${due.length} due`:'';
  const topicHtml=study.tags.length?`<div class="snapshot-topics">${study.tags.map((tag)=>`<span>${escapeHtml(tag)}</span>`).join('')}</div>`:'<p class="quiet">No topics assigned.</p>';
  const outlineHtml=outline?.sections.length
    ? `<div class="snapshot-outline">${outline.sections.map((section)=>`<div><span>${escapeHtml(formatPassage(section.passage))}</span><strong>${escapeHtml(section.label||'Untitled section')}</strong></div>`).join('')}</div>`
    : '<p class="quiet">No passage outline yet.</p>';
  const mainIdea=synthesis?.mainIdea?.trim();
  const application=synthesis?.application?.trim();
  const questionHtml=unresolved.length
    ? `<div class="snapshot-questions">${unresolved.slice(0,4).map((question)=>`<p>${escapeHtml(question.body??'Question')}</p>`).join('')}${unresolved.length>4?`<small>+${unresolved.length-4} more unresolved</small>`:''}</div>`
    : '<p class="quiet">No unresolved saved questions.</p>';
  $('#studySnapshotContent').innerHTML=`
    <div class="snapshot-reference">${escapeHtml(formatPassage(study.primaryPassage))}</div>
    <section><span class="mini-label">TOPICS</span>${topicHtml}</section>
    <section><span class="mini-label">MAIN IDEA</span>${mainIdea?`<p class="snapshot-main-idea">${escapeHtml(mainIdea)}</p>`:'<p class="quiet">No main idea written yet.</p>'}</section>
    <section><span class="mini-label">PASSAGE STRUCTURE</span>${outlineHtml}</section>
    <section><span class="mini-label">INTERPRETATION CLAIMS · ${claims.length}</span>${claimsSnapshotHtml(claims)}</section>
    <section><span class="mini-label">UNRESOLVED QUESTIONS · ${unresolved.length}</span>${questionHtml}</section>
    ${application?`<section><span class="mini-label">APPLICATION</span><p>${escapeHtml(application)}</p></section>`:''}
    <section class="snapshot-review"><span class="mini-label">REVIEW</span><p>${cards.length?`${cards.length} card${cards.length===1?'':'s'} · ${due.length} due now`:'No review cards created.'}</p></section>
  `;
  $('#studySnapshotDialog').showModal();
}
function studyTopicsHtml(study) {
  if(!study.tags.length)return '';
  return `<div class="study-topic-chips">${study.tags.map((tag)=>`<button type="button" data-topic-search="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</div>`;
}
async function openStudyMetadata(id) {
  const study=await repo.getStudy(id);
  if(!study)return;
  editingStudyId=id;
  $('#studyMetaTitle').value=study.title??formatPassage(study.primaryPassage);
  $('#studyMetaTags').value=study.tags.join(', ');
  $('#studyMetaDialog').showModal();
  await sleep(0);
  $('#studyMetaTitle').focus();
  $('#studyMetaTitle').select();
}
async function renderStudies(filter='') {
  const q=filter.trim().toLocaleLowerCase('en');
  const all=(await repo.listStudies()).filter((study)=>study.archived===showArchivedStudies);
  const studies=all.filter((study)=>{
    if(!q)return true;
    return [
      study.title??formatPassage(study.primaryPassage),
      formatPassage(study.primaryPassage),
      ...study.tags,
    ].some((value)=>value.toLocaleLowerCase('en').includes(q));
  });
  const studyRow=(study)=>`<article class="study-row" data-study-id="${escapeHtml(study.id)}"><button class="study-open" type="button"><strong>${escapeHtml(study.title??formatPassage(study.primaryPassage))}</strong><span>${escapeHtml(formatPassage(study.primaryPassage))} · ${new Date(study.updatedAt).toLocaleDateString()}</span></button>${studyTopicsHtml(study)}<div class="study-actions"><button type="button" data-study-action="snapshot">Snapshot</button><button type="button" data-study-action="edit">Edit</button><button type="button" data-study-action="archive-toggle">${showArchivedStudies?'Restore':'Archive'}</button></div></article>`;
  let html='';
  if(studies.length&&q){
    html=studies.sort((a,b)=>b.updatedAt-a.updatedAt).map(studyRow).join('');
  } else if(studies.length&&studyArchiveView==='topics'){
    const groups=new Map();
    const untagged=[];
    for(const study of studies){
      if(!study.tags.length){untagged.push(study);continue;}
      for(const tag of study.tags){
        const key=tag.toLocaleLowerCase('en');
        const group=groups.get(key)??{label:tag,studies:[]};
        group.studies.push(study);
        groups.set(key,group);
      }
    }
    const sections=[...groups.values()]
      .sort((a,b)=>a.label.localeCompare(b.label,undefined,{sensitivity:'base'}))
      .map((group)=>`<section class="study-book-group study-topic-group"><header><button class="study-group-title" data-topic-overview="${escapeHtml(group.label)}" type="button"><strong>${escapeHtml(group.label)}</strong><small>Overview</small></button><span>${group.studies.length}</span></header>${group.studies.sort((a,b)=>compareVerseRefs(a.primaryPassage.start,b.primaryPassage.start)).map(studyRow).join('')}</section>`);
    if(untagged.length)sections.push(`<section class="study-book-group study-topic-group untagged"><header><strong>Untagged</strong><span>${untagged.length}</span></header>${untagged.sort((a,b)=>b.updatedAt-a.updatedAt).map(studyRow).join('')}</section>`);
    html=sections.join('');
  } else if(studies.length){
    const groups=new Map();
    for(const study of studies){
      const bookId=study.primaryPassage.start.book;
      const list=groups.get(bookId)??[];
      list.push(study);
      groups.set(bookId,list);
    }
    html=BOOKS.filter((book)=>groups.has(book.id)).map((book)=>{
      const items=groups.get(book.id).sort((a,b)=>compareVerseRefs(a.primaryPassage.start,b.primaryPassage.start)||compareVerseRefs(a.primaryPassage.end,b.primaryPassage.end));
      return `<section class="study-book-group"><header><button class="study-group-title" data-book-overview="${escapeHtml(book.id)}" type="button"><strong>${escapeHtml(book.name)}</strong><small>Overview</small></button><span>${items.length}</span></header>${items.map(studyRow).join('')}</section>`;
    }).join('');
  } else {
    html=`<p class="quiet">${showArchivedStudies?'No archived studies.':'No saved studies yet. Selah creates one when you first write or annotate.'}</p>`;
  }
  elements.studiesList.innerHTML=html;
  queryAll('[data-book-overview]').forEach((button)=>button.addEventListener('click',async()=>{await openBookOverview(button.dataset.bookOverview);}));
  queryAll('.study-open').forEach((button)=>button.addEventListener('click',async()=>{
    const row=button.closest('[data-study-id]');
    if(row)await openStudyById(row.dataset.studyId);
  }));
  queryAll('[data-topic-search]').forEach((button)=>button.addEventListener('click',(event)=>{
    event.stopPropagation();
    elements.studySearch.value=button.dataset.topicSearch;
    renderStudies(elements.studySearch.value);
  }));
  queryAll('[data-study-action]').forEach((button)=>button.addEventListener('click',async()=>{
    const row=button.closest('[data-study-id]');
    const id=row?.dataset.studyId;
    if(!id)return;
    if(button.dataset.studyAction==='snapshot'){
      await openStudySnapshot(id);
      return;
    }
    if(button.dataset.studyAction==='edit'){
      await openStudyMetadata(id);
      return;
    }
    if(button.dataset.studyAction==='archive-toggle'){
      await studyService.setArchived(id,!showArchivedStudies);
      if(!showArchivedStudies&&currentStudy?.id===id)currentStudy=undefined;
      await renderStudies(elements.studySearch.value);
      toast(showArchivedStudies?'Study restored.':'Study archived.');
    }
  }));
}
function downloadTextFile(name,text,type='application/json') {
  const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function togglePatterns() {
  const button=$('#patternsBtn'); button.classList.toggle('active'); button.setAttribute('aria-pressed',String(button.classList.contains('active'))); patternTokenIds.clear();
  if(button.classList.contains('active')) {
    for(const pattern of analyzePatterns(currentScripture)) for(const hit of pattern.occurrences) patternTokenIds.add(hit.tokenId);
    for(const marker of analyzeStructuralMarkers(currentScripture)) for(const hit of marker.occurrences) patternTokenIds.add(hit.tokenId);
  }
  await renderScripture();
}
async function updateSelectionLens() {
  if(!selectedRangeInfo)return;
  const verses=currentScripture.verses.filter((verse)=>compareVerseRefs(verse.ref,selectedRangeInfo.passage.start)>=0&&compareVerseRefs(verse.ref,selectedRangeInfo.passage.end)<=0);
  try { const lens=await lensService.forPassage({translationId:currentScripture.translationId,passage:selectedRangeInfo.passage,verses}); const lexical=lens.lexicalKeys.slice(0,2).join(' · '); $('#selectionLensMeta').textContent=`${lens.crossReferenceCount} refs · ${lens.backlinkCount} linked here · ${lens.annotationCount} notes${lexical?` · ${lexical}`:''}`; } catch { $('#selectionLensMeta').textContent='Selection'; }
}
async function createAnnotationFromSelection(body) {
  if(!selectedRangeInfo)return; const study=await ensureStudy(); setSaving(true);
  if(pendingAnnotationKind==='question') await annotationService.createQuestion(selectedRangeInfo.passage,body,study.id);
  else if(selectedRangeInfo.sameVerse) await annotationService.createTextNote({translationId:currentScripture.translationId,verse:selectedRangeInfo.passage.start,startTokenId:selectedRangeInfo.startTokenId,endTokenId:selectedRangeInfo.endTokenId,quotedText:selectedRangeInfo.quotedText,body,studyId:study.id});
  else await annotationService.createRangeTextNote({translationId:currentScripture.translationId,passage:selectedRangeInfo.passage,startTokenId:selectedRangeInfo.startTokenId,endTokenId:selectedRangeInfo.endTokenId,quotedText:selectedRangeInfo.quotedText,body,studyId:study.id});
  await studyService.touch(study.id);setSaving(false);await renderScripture();if(activeTab==='notes'||activeTab==='guide')await renderActiveTab();
}
async function highlightSelection() {
  if(!selectedRangeInfo)return;
  const study=await ensureStudy();
  if(selectedRangeInfo.sameVerse) {
    await annotationService.createHighlight({translationId:currentScripture.translationId,verse:selectedRangeInfo.passage.start,startTokenId:selectedRangeInfo.startTokenId,endTokenId:selectedRangeInfo.endTokenId,quotedText:selectedRangeInfo.quotedText,studyId:study.id});
  } else {
    await annotationService.createRangeHighlight({translationId:currentScripture.translationId,passage:selectedRangeInfo.passage,startTokenId:selectedRangeInfo.startTokenId,endTokenId:selectedRangeInfo.endTokenId,quotedText:selectedRangeInfo.quotedText,studyId:study.id});
  }
  await studyService.touch(study.id); await renderScripture();
}
$('#referenceForm').addEventListener('submit',async(event)=>{event.preventDefault();const query=elements.referenceInput.value.trim();try{const scripture=await resolveReferenceInput(query);await switchPrimaryPassage(scripture);}catch(error){if(/Unknown Bible book|Could not parse reference|Reference is empty/.test(error instanceof Error?error.message:'')){await renderSearchResults(query);return;}toast(error instanceof Error?error.message:'Unable to open passage');}});
$('#backBtn').addEventListener('click',async()=>{workspace=await workspaceService.back(workspace);await setCurrentScripture(await scriptureProvider.getPassage(workspace.primaryPassage));});
$('#prevChapterBtn').addEventListener('click',()=>openAdjacentChapter(-1));
$('#nextChapterBtn').addEventListener('click',()=>openAdjacentChapter(1));
$('#forwardBtn').addEventListener('click',async()=>{workspace=await workspaceService.forward(workspace);await setCurrentScripture(await scriptureProvider.getPassage(workspace.primaryPassage));});
$('#studyTabs').addEventListener('click',async(event)=>{const tab=event.target.closest('[data-tab]');if(!tab)return;activeTab=tab.dataset.tab;await renderActiveTab();mobileStudyCtl.open();});
$('#studyTabs').addEventListener('keydown',(event)=>{
  const tabs=queryAll('#studyTabs [role="tab"]:not([hidden])');
  const current=tabs.indexOf(document.activeElement);
  if(current<0)return;
  let next=current;
  if(event.key==='ArrowRight')next=(current+1)%tabs.length;
  else if(event.key==='ArrowLeft')next=(current-1+tabs.length)%tabs.length;
  else if(event.key==='Home')next=0;
  else if(event.key==='End')next=tabs.length-1;
  else return;
  event.preventDefault();
  tabs[next].focus();
  tabs[next].click();
});
$('#patternsBtn').addEventListener('click',togglePatterns);
$('#focusBtn').addEventListener('click',(event)=>{document.body.classList.toggle('reading-focus');event.currentTarget.classList.toggle('active');event.currentTarget.setAttribute('aria-pressed',String(event.currentTarget.classList.contains('active')));});
$('#themeBtn').addEventListener('click',async()=>{const settings=await repo.getSettings();const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;await repo.setSettings({...settings,theme:next});});
$('#reviewCardForm').addEventListener('submit',async(event)=>{
  if(event.submitter?.value==='cancel'){reviewCardStudyId=undefined;editingReviewCardId=undefined;return;}
  event.preventDefault();
  if(!reviewCardStudyId)return;
  const prompt=$('#reviewCardQuestion').value;
  const answer=$('#reviewCardAnswer').value;
  try{
    if(editingReviewCardId)await reviewService.updateCustom(editingReviewCardId,prompt,answer);
    else await reviewService.createCustom(reviewCardStudyId,prompt,answer);
    $('#reviewCardDialog').close();
    reviewCardStudyId=undefined;
    editingReviewCardId=undefined;
    await refreshReviewBadge();
    if(!elements.reviewDrawer.hidden)await renderReview(reviewStudyFilter);
    toast('Review card saved.');
  }catch(error){toast(error instanceof Error?error.message:'Unable to save review card');}
});
$('#reviewCardDialog').addEventListener('close',()=>{reviewCardStudyId=undefined;editingReviewCardId=undefined;});
$('#reviewBtn').addEventListener('click',async(event)=>{reviewStudyFilter=undefined;studiesDrawerCtl.close(false);reviewDrawerCtl.open(event.currentTarget);await renderReview();});
$('#reviewClose').addEventListener('click',()=>reviewDrawerCtl.close());
$('#studiesBtn').addEventListener('click',async(event)=>{reviewDrawerCtl.close(false);studiesDrawerCtl.open(event.currentTarget);await renderStudies();});
$('#drawerClose').addEventListener('click',()=>studiesDrawerCtl.close());
$('#studySnapshotOpen').addEventListener('click',async()=>{
  if(!snapshotStudyId)return;
  const id=snapshotStudyId;
  $('#studySnapshotDialog').close();
  await openStudyById(id);
});
$('#studySnapshotReview').addEventListener('click',async()=>{
  if(!snapshotStudyId)return;
  const id=snapshotStudyId;
  reviewStudyFilter=id;
  $('#studySnapshotDialog').close();
  studiesDrawerCtl.close(false);
  reviewDrawerCtl.open($('#reviewBtn'));
  await renderReview(id);
});
$('#studySnapshotDialog').addEventListener('close',()=>{snapshotStudyId=undefined;});
$('#bookUnderstanding').addEventListener('input',(event)=>{if(activeBookId)scheduleBookUnderstandingSave(activeBookId,event.target.value);});
$('#bookOverviewDialog').addEventListener('close',()=>{flushBookUnderstandingSave().catch(()=>{});activeBookId=undefined;});
elements.studySearch.addEventListener('input',()=>renderStudies(elements.studySearch.value));
queryAll('[data-study-view]').forEach((button)=>button.addEventListener('click',async()=>{
  studyArchiveView=button.dataset.studyView;
  queryAll('[data-study-view]').forEach((candidate)=>candidate.setAttribute('aria-pressed',String(candidate===button)));
  elements.studySearch.value='';
  await renderStudies();
}));
$('#studyMetaForm').addEventListener('submit',async(event)=>{
  if(event.submitter?.value==='cancel'){editingStudyId=undefined;return;}
  event.preventDefault();
  if(!editingStudyId)return;
  const title=$('#studyMetaTitle').value;
  const tags=$('#studyMetaTags').value.split(',').map((tag)=>tag.trim());
  try{
    const updated=await studyService.updateMetadata(editingStudyId,{title,tags});
    if(currentStudy?.id===editingStudyId)currentStudy=updated;
    editingStudyId=undefined;
    $('#studyMetaDialog').close();
    await renderStudies(elements.studySearch.value);
    toast('Study metadata saved.');
  }catch(error){toast(error instanceof Error?error.message:'Unable to save study metadata');}
});
$('#archivedStudiesBtn').addEventListener('click',async(event)=>{
  showArchivedStudies=!showArchivedStudies;
  event.currentTarget.setAttribute('aria-pressed',String(showArchivedStudies));
  event.currentTarget.classList.toggle('active',showArchivedStudies);
  elements.studySearch.value='';
  await renderStudies();
});
$('#backupBtn').addEventListener('click',async()=>{const envelope=createBackup(await repo.exportSnapshot());downloadTextFile(`selah-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(envelope,null,2));toast('Backup exported.');});
$('#restoreBtn').addEventListener('click',()=>$('#restoreInput').click());
$('#restoreInput').addEventListener('change',async(event)=>{const file=event.target.files?.[0];if(!file)return;try{const backup=parseBackup(await file.text());await repo.importSnapshot(backup.snapshot,'replace');toast('Backup restored. Reloading…');setTimeout(()=>location.reload(),500);}catch(error){toast(error instanceof Error?error.message:'Invalid backup');}finally{event.target.value='';}});
$('#peekClose').addEventListener('click',()=>peekCtl.close());
$('#peekOpen').addEventListener('click',async()=>{if(activePeekPassage){peekCtl.close(false);await navigateResearch(activePeekPassage);}});
async function buildCurrentStudyContextExport() {
  if(!currentStudy)throw new Error('Write or annotate first so there is a study to export.');
  return exportStudyContextMarkdown({
    study:currentStudy,
    scripture:currentScripture,
    annotations:await annotationService.forPassage(currentScripture.passage,currentScripture.translationId,currentStudy.id),
    document:await repo.getStudyDocument(currentStudy.id),
    outline:await repo.getStudyOutline(currentStudy.id),
    claims:await repo.listInterpretationClaims(currentStudy.id),
    synthesis:await repo.getStudySynthesis(currentStudy.id),
    options:{
      includeScripture:$('#exportScripture').checked,
      includeAnnotations:$('#exportAnnotations').checked,
      includeDocument:$('#exportDocument').checked,
      includeOutline:$('#exportOutline').checked,
      includeClaims:$('#exportClaims').checked,
      includeSynthesis:$('#exportSynthesis').checked,
      tutorPrompt:$('#exportTutor').value,
    },
  });
}
$('#exportBtn').addEventListener('click',()=>elements.exportDialog.showModal());
$('#copyExportBtn').addEventListener('click',async()=>{
  try{
    const markdown=await buildCurrentStudyContextExport();
    await navigator.clipboard.writeText(markdown);
    elements.exportDialog.close();
    toast('Study context copied.');
  }catch(error){toast(error instanceof Error?error.message:'Unable to copy study context');}
});
$('#openChatGPTBtn').addEventListener('click',async()=>{
  try{
    const markdown=await buildCurrentStudyContextExport();
    const copyPromise=navigator.clipboard.writeText(markdown);
    const opened=window.open('https://chatgpt.com/','_blank','noopener,noreferrer');
    await copyPromise;
    elements.exportDialog.close();
    toast(opened?'Study context copied. Paste it into ChatGPT.':'Study context copied. If ChatGPT did not open, open it and paste.');
  }catch(error){toast(error instanceof Error?error.message:'Unable to hand off study context');}
});
elements.scripture.addEventListener('click',async(event)=>{
  const verseButton=event.target.closest('.verse-number');if(verseButton){const verse=verseButton.closest('.verse');context.patch({activeVerse:{book:verse.dataset.book,chapter:Number(verse.dataset.chapter),verse:Number(verse.dataset.verse)}});return;}
  const tokenEl=event.target.closest('[data-token-id]');if(tokenEl){selectedToken=tokenById(tokenEl.dataset.tokenId); selectedLexicalKey=selectedToken?.strongs;const verse=verseByTokenId(tokenEl.dataset.tokenId);if(verse)context.patch({activeVerse:verse.ref,selection:{range:{start:verse.ref,end:verse.ref},text:selectedToken.text,tokenIds:[selectedToken.id]}});}
});
elements.scripture.addEventListener('pointerup',()=>{setTimeout(()=>{selectedRangeInfo=selectedTokenRange();if(!selectedRangeInfo){elements.selectionMenu.hidden=true;return;}const selection=getSelection();const rect=selection.getRangeAt(0).getBoundingClientRect();elements.selectionMenu.style.left=`${Math.max(8,Math.min(innerWidth-290,rect.left+rect.width/2-120))}px`;elements.selectionMenu.style.top=`${Math.max(60,rect.top-68)}px`;elements.selectionMenu.hidden=false;$('#selectionLensMeta').textContent='Loading context…';context.patch({selection:{range:selectedRangeInfo.passage,text:selectedRangeInfo.quotedText,tokenIds:[selectedRangeInfo.startTokenId,selectedRangeInfo.endTokenId]}});updateSelectionLens();},0);});
elements.selectionMenu.addEventListener('click',async(event)=>{const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;elements.selectionMenu.hidden=true;if(action==='note'||action==='question'){editingAnnotationId=undefined;editingAnnotationField=undefined;pendingAnnotationKind=action;$('#noteDialogTitle').textContent=action==='question'?'Add question':'Add note';elements.noteAnchorLabel.textContent=selectedRangeInfo?.quotedText?`“${selectedRangeInfo.quotedText}”`:formatPassage(selectedRangeInfo.passage);elements.noteBody.value='';elements.noteDialog.showModal();await sleep(0);elements.noteBody.focus();}if(action==='highlight')await highlightSelection();if(action==='outline'&&selectedRangeInfo){outlineDraftPassage=structuredClone(selectedRangeInfo.passage);activeTab='outline';await renderActiveTab();}if(action==='word'){const id=selectedRangeInfo?.startTokenId;selectedToken=tokenById(id);activeTab='words';await renderActiveTab();}if(action==='compare'){activeTab='compare';await renderActiveTab();}if(action==='copy'&&selectedRangeInfo)await navigator.clipboard.writeText(selectedRangeInfo.quotedText);});
elements.noteForm.addEventListener('submit',async(event)=>{
  if(event.submitter?.value==='cancel'){editingAnnotationId=undefined;editingAnnotationField=undefined;return;}
  event.preventDefault();
  const body=elements.noteBody.value.trim();
  if(!body)return;
  if(editingAnnotationId&&editingAnnotationField){
    await annotationService.update(editingAnnotationId,{[editingAnnotationField]:body});
    if(currentStudy)await studyService.touch(currentStudy.id);
    editingAnnotationId=undefined;
    editingAnnotationField=undefined;
    elements.noteDialog.close();
    await renderNotes();
    return;
  }
  await createAnnotationFromSelection(body);
  elements.noteDialog.close();
});
document.addEventListener('pointerdown',(event)=>{if(!elements.selectionMenu.hidden&&!elements.selectionMenu.contains(event.target)&&!elements.scripture.contains(event.target))elements.selectionMenu.hidden=true;});
document.addEventListener('keydown',async(event)=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();elements.referenceInput.focus();elements.referenceInput.select();return;}
  if(event.altKey&&event.key==='ArrowLeft'){event.preventDefault();$('#backBtn').click();return;}
  if(event.altKey&&event.key==='ArrowRight'){event.preventDefault();$('#forwardBtn').click();return;}
  if(event.key==='Escape'){if(mobileStudyCtl.close(true))return;peekCtl.close();studiesDrawerCtl.close();reviewDrawerCtl.close();return;}
  const target=event.target;
  const editing=target instanceof Element&&Boolean(target.closest('input,textarea,select,[contenteditable="true"]'));
  if(editing||event.ctrlKey||event.metaKey||event.altKey)return;
  const shortcut={n:'note',q:'question',h:'highlight',o:'outline'}[event.key.toLowerCase()];
  if(!shortcut)return;
  const range=selectedTokenRange();
  if(!range)return;
  event.preventDefault();
  selectedRangeInfo=range;
  context.patch({selection:{range:range.passage,text:range.quotedText,tokenIds:[range.startTokenId,range.endTokenId]}});
  const action=$(`[data-action="${shortcut}"]`);
  if(action&&!action.hidden)action.click();
});
const divider=$('#divider');let dragging=false;let bibleWidth=56;
function setBibleWidth(value){bibleWidth=Math.max(38,Math.min(72,value));document.documentElement.style.setProperty('--bible-width',`${bibleWidth}%`);divider.setAttribute('aria-valuenow',String(Math.round(bibleWidth)));}
divider.addEventListener('pointerdown',(event)=>{dragging=true;divider.setPointerCapture(event.pointerId);});
divider.addEventListener('pointermove',(event)=>{if(!dragging||innerWidth<=760)return;setBibleWidth(event.clientX/innerWidth*100);});
divider.addEventListener('pointerup',()=>dragging=false);
divider.addEventListener('keydown',(event)=>{if(innerWidth<=760)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();setBibleWidth(bibleWidth+(event.key==='ArrowRight'?2:-2));}else if(event.key==='Home'){event.preventDefault();setBibleWidth(38);}else if(event.key==='End'){event.preventDefault();setBibleWidth(72);}});
if(matchMedia('(max-width:760px)').matches) elements.scripture.addEventListener('click',(event)=>{if(!event.target.closest('[data-token-id],.verse-number')&&$('#studyPane').classList.contains('open'))$('#studyPane').classList.remove('open');});
const settings=await repo.getSettings();
const preferredTheme=settings.theme==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):settings.theme;
document.documentElement.dataset.theme=preferredTheme;
syncTranslationComparisonAvailability();
await loadInitial();
await refreshReviewBadge();
if('serviceWorker'in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
