import { parseReference, formatPassage, canonicalPassageId, compareVerseRefs, BOOK_BY_ID, BOOKS, VerseBoundsIndex } from './core/domain/references/index.js';
import { PassageContextStore } from './core/domain/context/index.js';
import { createResearchTrail, extractStudyDocumentScriptureLinks } from './core/domain/studies/index.js';
import { IndexedDbSelahRepository, createBackup, parseBackup } from './core/persistence/index.js';
import { BsbScriptureProvider, FetchTextAssetLoader, BsbResearchProvider } from './core/data/bsb/index.js';
import { AnnotationService, annotationMatchesPassage } from './core/annotations/index.js';
import { StudyService, WorkspaceService } from './core/study/index.js';
import { LensService } from './core/study/lens/index.js';
import { PassageGuideService } from './core/study/guide/index.js';
import { OriginalLanguageService } from './core/research/original-language/index.js';
import { TranslationRegistry } from './core/research/compare/index.js';
import { analyzePatterns, analyzeStructuralMarkers } from './core/bible/patterns/index.js';
import { indentPhrase, outdentPhrase, updatePhraseNode, splitPhraseNode, mergePhraseWithPrevious } from './core/bible/phrasing/index.js';
import { exportStudyContextMarkdown } from './core/export/index.js';
import { ScriptureSearchIndex, PersonalStudySearchIndex } from './core/search/index.js';

const $ = (selector) => document.querySelector(selector);
const $ = (selector) => [...document.querySelectorAll(selector)];
const queryAll = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (value='') => value.replace(/[&<>'"]/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
const sleep = (ms) => new Promise((resolve)=>setTimeout(resolve,ms));

const elements = {
  scripture: $('#scripture'), studyContent: $('#studyContent'), referenceInput: $('#referenceInput'), passageStatus: $('#passageStatus'),
  selectionMenu: $('#selectionMenu'), noteDialog: $('#noteDialog'), noteForm: $('#noteForm'), noteBody: $('#noteBody'), noteAnchorLabel: $('#noteAnchorLabel'),
  saveState: $('#saveState'), peek: $('#peek'), peekTitle: $('#peekTitle'), peekText: $('#peekText'), peekOpen: $('#peekOpen'),
  studiesDrawer: $('#studiesDrawer'), studiesList: $('#studiesList'), studySearch: $('#studySearch'), exportDialog: $('#exportDialog'), toast: $('#toast')
};

const repo = new IndexedDbSelahRepository();
await repo.initialize();
const loader = new FetchTextAssetLoader('./data/bsb');
const scriptureProvider = new BsbScriptureProvider(loader);
const researchProvider = new BsbResearchProvider(loader);
const annotationService = new AnnotationService(repo);
const studyService = new StudyService(repo);
const workspaceService = new WorkspaceService(repo);
const guideService = new PassageGuideService(annotationService, researchProvider, scriptureProvider, researchProvider);
const lensService = new LensService(annotationService, researchProvider);
const originalLanguage = new OriginalLanguageService(scriptureProvider, researchProvider, researchProvider, researchProvider);
const translations = new TranslationRegistry([scriptureProvider]);

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
let pendingAnnotationKind='note';
let showArchivedStudies=false;
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

async function loadVerseBounds() {
  verseBoundsPromise ??= fetch('./data/bsb/max-verses.json').then(async(response)=>{if(!response.ok)return undefined;return new VerseBoundsIndex(await response.json());}).catch(()=>undefined);
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

async function renderSearchResults(query) {
  elements.studyContent.innerHTML='<div class="loading">Searching Scripture and studies…</div>';
  const [scriptureResults,snapshot]=await Promise.all([searchScripture(query,30).catch(()=>[]),repo.exportSnapshot()]);
  const personal=new PersonalStudySearchIndex(); personal.rebuild({studies:snapshot.studies,documents:snapshot.studyDocuments,annotations:snapshot.annotations});
  const personalResults=personal.search(query,30);
  elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">SEARCH</span><h2>${escapeHtml(query)}</h2><p class="panel-lede">Search is part of the study workspace: Scripture and your own material, not a separate dashboard.</p><section class="panel-section"><h3>Scripture</h3>${scriptureResults.map((result)=>`<button class="reference-card search-scripture" type="button" data-reference="${escapeHtml(formatPassage({start:result.ref,end:result.ref}))}"><strong>${escapeHtml(formatPassage({start:result.ref,end:result.ref}))}</strong><span>${escapeHtml(result.text)}</span></button>`).join('')||'<p class="quiet">No Scripture matches.</p>'}</section><section class="panel-section"><h3>Your studies</h3>${personalResults.map((result)=>`<button class="reference-card search-personal" type="button"${result.studyId?` data-study-id="${escapeHtml(result.studyId)}"`:''}><strong>${escapeHtml(result.title)}</strong><span>${escapeHtml(result.excerpt)}</span></button>`).join('')||'<p class="quiet">No personal-study matches.</p>'}</section></section>`;
  $$('.search-scripture').forEach((button)=>button.addEventListener('click',async()=>{const scripture=await resolveReferenceInput(button.dataset.reference);await switchPrimaryPassage(scripture);}));
  $$('.search-personal[data-study-id]').forEach((button)=>button.addEventListener('click',async()=>{const study=await repo.getStudy(button.dataset.studyId);if(!study)return;currentStudy=study;const existing=(await repo.listWorkspaces()).find((x)=>x.studyId===study.id);workspace=existing??await workspaceService.create(study.primaryPassage,'BSB',study.id);await workspaceService.markLastOpened(workspace);await setCurrentScripture(await scriptureProvider.getPassage(workspace.primaryPassage));}));
}

async function resolveReferenceInput(input) {
  const parsed = parseReference(input);
  if (parsed.kind === 'passage') {
    const bounds=await loadVerseBounds();
    bounds?.validatePassage(parsed.passage);
    const scripture=await scriptureProvider.getPassage(parsed.passage);
    const first=scripture.verses[0]?.ref; const last=scripture.verses.at(-1)?.ref;
    const sameRef=(a,b)=>Boolean(a&&b&&a.book===b.book&&a.chapter===b.chapter&&a.verse===b.verse);
    if(!sameRef(first,parsed.passage.start)||!sameRef(last,parsed.passage.end)) throw new Error('Scripture data for that passage is not installed in this build.');
    return scripture;
  }
  const broad = { start:{book:parsed.book,chapter:parsed.chapter,verse:1}, end:{book:parsed.book,chapter:parsed.chapter,verse:200} };
  const scripture = await scriptureProvider.getPassage(broad);
  if (!scripture.verses.length) throw new Error('No Scripture data is installed for that chapter.');
  scripture.passage = { start: scripture.verses[0].ref, end: scripture.verses.at(-1).ref };
  return scripture;
}

async function getStudyForPassage(passage) {
  const id = canonicalPassageId(passage);
  const studies = await repo.listStudies();
  return studies.find((study)=>canonicalPassageId(study.primaryPassage) === id && !study.archived);
}

async function switchPrimaryPassage(scripture) {
  currentStudy = await getStudyForPassage(scripture.passage);
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
  currentScripture = scripture;
  selectedToken = undefined;
  selectedRangeInfo = undefined;
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
  currentScripture=undefined;
  currentStudy=undefined;
  selectedToken=undefined;
  selectedRangeInfo=undefined;
  patternTokenIds.clear();
  elements.referenceInput.value='';
  elements.passageStatus.textContent='No passage open';
  document.title='Selah';
  elements.scripture.innerHTML=`<div class="passage-launcher"><span class="launcher-wordmark">SELAH</span><h1>What are you studying?</h1><p>${escapeHtml(message)}</p><button class="primary-button" id="launcherReference" type="button">Choose a passage</button></div>`;
  elements.studyContent.innerHTML=`<section class="study-empty"><span class="eyebrow">STUDY WORKSPACE</span><p>Study tools follow the passage you open. Your saved studies remain available under <strong>Studies</strong>.</p><button class="text-button" id="launcherStudies" type="button">Open saved studies</button></section>`;
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
    currentStudy = workspace.studyId ? await repo.getStudy(workspace.studyId) : await getStudyForPassage(scripture.passage);
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
  const annotations = await annotationService.forPassage(currentScripture.passage,currentScripture.translationId,currentStudy?.id);
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
    if (verse.heading && verse.heading !== previousHeading) {
      html.push(`<p class="section-heading">${escapeHtml(verse.heading)}</p>`);
      previousHeading = verse.heading;
    }
    const refKey = `${verse.ref.book}.${verse.ref.chapter}.${verse.ref.verse}`;
    const hasNote = noteVerses.has(refKey) ? ' has-note' : '';
    const tokenHtml = verse.tokens.map((token)=>`<span class="token${patternTokenIds.has(token.id)?' pattern-hit':''}" data-token-id="${escapeHtml(token.id)}"${token.strongs?` data-strongs="${escapeHtml(token.strongs)}"`:''}>${escapeHtml(token.text)}</span>`).join('');
    html.push(`<p class="verse${hasNote}" data-book="${verse.ref.book}" data-chapter="${verse.ref.chapter}" data-verse="${verse.ref.verse}"><button class="verse-number" type="button" aria-label="Verse ${verse.ref.verse}">${verse.ref.verse}</button>${tokenHtml}</p>`);
  }
  elements.scripture.innerHTML = html.join('');
  applyAnnotationHighlights(annotations);
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
  const tokenEls = $$('.token');
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
    const guide = await guideService.build(currentScripture);
    const book = BOOK_BY_ID.get(currentScripture.passage.start.book);
    elements.studyContent.innerHTML = `<section class="panel">
      <span class="eyebrow">PASSAGE GUIDE</span><h2>${escapeHtml(formatPassage(currentScripture.passage))}</h2>
      <p class="panel-lede">A compact map of study directions. The Guide points to evidence; it does not replace reading the passage.</p>
      <section class="panel-section"><h3>Context</h3><dl class="facts"><div><dt>Book</dt><dd>${escapeHtml(book?.name??'')}</dd></div><div><dt>Canon</dt><dd>${book?.testament==='NT'?'New Testament':'Old Testament'}</dd></div><div><dt>Your annotations</dt><dd>${guide.annotations.length}</dd></div></dl>${guide.literaryContext.length?`<div class="literary-context"><span class="mini-label">Literary context</span>${guide.literaryContext.map((section)=>`<button type="button" class="context-section ${section.role}" data-reference="${escapeHtml(formatPassage(section.passage))}"><span>${section.role}</span><strong>${escapeHtml(section.heading)}</strong><small>${escapeHtml(formatPassage(section.passage))}</small></button>`).join('')}</div>`:''}${guide.sections.length?`<div class="passage-sections"><span class="mini-label">Headings inside selection</span>${guide.sections.map((section)=>`<button type="button" class="section-jump" data-verse="${section.verse}"><span>v.${section.verse}</span>${escapeHtml(section.heading)}</button>`).join('')}</div>`:''}</section>
      <section class="panel-section"><h3>Repeated signals</h3><div class="metric-row">${guide.patterns.slice(0,8).map((p)=>`<span class="metric">${escapeHtml(p.label)} × ${p.count}</span>`).join('')||'<span class="quiet">No repeated signals in the current selection.</span>'}</div></section>
      <section class="panel-section"><h3>Discourse markers</h3><div class="metric-row">${guide.structuralMarkers.slice(0,12).map((marker)=>`<span class="metric">${escapeHtml(marker.label)} · ${escapeHtml(marker.category.replace('purpose-result','purpose/result'))}</span>`).join('')||'<span class="quiet">No explicit discourse markers detected in this selection.</span>'}</div><p class="quiet">These are textual signals in the English translation, not automatic interpretations of the argument.</p></section>
      <section class="panel-section"><h3>Cross-references</h3><div>${guide.crossReferences.slice(0,8).map(referenceButtonHtml).join('')||'<p class="quiet">No outgoing references available.</p>'}</div></section>
      <section class="panel-section"><h3>Referenced by</h3><div>${guide.backlinks.slice(0,8).map(backlinkButtonHtml).join('')||'<p class="quiet">No incoming references are indexed for this passage.</p>'}</div></section>
      <section class="panel-section"><h3>Important words</h3><div class="lexical-guide-list">${guide.importantLexicalItems.map((item)=>{const entry=item.entry;const title=entry?.lemma||item.strongs;const detail=[entry?.transliteration,entry?.gloss,item.strongs,`× ${item.count}`].filter(Boolean).join(' · ');return `<button class="reference-card lexical-key" type="button" data-strongs="${escapeHtml(item.strongs)}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></button>`;}).join('')||'<p class="quiet">Lexical alignment is unavailable in this installed fixture.</p>'}</div></section>
      <section class="panel-section"><h3>Resources</h3>${guide.resources.map(({resource,url})=>resourceLinkHtml(resource,url)).join('')}</section>
    </section>`;
    wireReferenceButtons(); wireLexicalButtons(); wireSectionJumps();
  } catch (error) { renderToolError('Guide unavailable',error); }
}

function referenceButtonHtml(ref) {
  const target=formatPassage(ref.target);
  return `<button class="reference-card" type="button" data-reference="${escapeHtml(target)}"><strong>${escapeHtml(target)}</strong><span>Referenced from this passage</span></button>`;
}
function backlinkButtonHtml(ref) {
  const source=formatPassage(ref.source);
  return `<button class="reference-card" type="button" data-reference="${escapeHtml(source)}"><strong>${escapeHtml(source)}</strong><span>Points to this passage</span></button>`;
}
function resourceLinkHtml(resource,url) { return `<a class="resource-link" href="${escapeHtml(url)}" target="_blank" rel="noopener"><span>${escapeHtml(resource.name)}</span><small>${escapeHtml(resource.category)} ↗</small></a>`; }

async function renderNotes() {
  const annotations = await annotationService.forPassage(currentScripture.passage,currentScripture.translationId,currentStudy?.id);
  const document = currentStudy ? await repo.getStudyDocument(currentStudy.id) : undefined;
  const documentText=document?.plainText??'';
  const links=extractStudyDocumentScriptureLinks(documentText);
  const linkedHtml=links.length?`<section class="panel-section linked-scripture"><h3>Linked Scripture</h3><div class="metric-row">${links.map((link)=>`<button class="metric" type="button" data-reference="${escapeHtml(formatPassage(link.passage))}">${escapeHtml(link.label)}</button>`).join('')}</div><p class="quiet">Type references as <code>[[Romans 8:1-4]]</code>. Links remain ordinary plaintext and open as Peeks.</p></section>`:'';
  elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">STUDY DOCUMENT</span><h2>${escapeHtml(formatPassage(currentScripture.passage))}</h2><p class="panel-lede">Write synthesis here; keep verse-specific observations anchored directly to Scripture.</p>
    <section class="panel-section"><h3>Anchored material</h3><div class="annotation-list">${annotations.map(annotationHtml).join('')||'<p class="quiet">Select Scripture and add a note, question, or highlight.</p>'}</div></section>
    <textarea class="study-document" id="studyDocument" placeholder="Observations\n\nQuestions\n\nStructure\n\nInterpretation\n\nConnections\n\nSummary">${escapeHtml(documentText)}</textarea>${linkedHtml}</section>`;
  $('#studyDocument').addEventListener('input',(event)=>{scheduleDocumentSave(event.target.value);renderStudyDocumentLinks(event.target.value);});
  wireAnnotationActions(); wireReferenceButtons();
}

function annotationHtml(annotation) {
  const anchor = annotation.anchor.type==='reference' ? formatPassage(annotation.anchor.passage) : (annotation.anchor.type==='text'||annotation.anchor.type==='text-range') ? annotation.anchor.quotedText : 'original-language token';
  const body = annotation.body || (annotation.kind==='highlight' ? `Highlight (${annotation.highlightStyle??'default'})` : '');
  const editable=annotation.kind!=='highlight' && annotation.body;
  return `<article class="annotation-item" data-annotation-id="${escapeHtml(annotation.id)}"><div class="annotation-heading"><div><span class="annotation-kind">${escapeHtml(annotation.kind)}</span><span class="annotation-anchor">${escapeHtml(anchor)}</span></div><div class="annotation-actions">${editable?'<button type="button" data-annotation-action="edit">Edit</button>':''}<button type="button" data-annotation-action="delete">Delete</button></div></div>${body?`<p>${escapeHtml(body)}</p>`:''}</article>`;
}

function renderStudyDocumentLinks(text) {
  const links=extractStudyDocumentScriptureLinks(text);
  let section=$('.linked-scripture');
  if(!links.length){section?.remove();return;}
  const html=`<h3>Linked Scripture</h3><div class="metric-row">${links.map((link)=>`<button class="metric" type="button" data-reference="${escapeHtml(formatPassage(link.passage))}">${escapeHtml(link.label)}</button>`).join('')}</div><p class="quiet">Type references as <code>[[Romans 8:1-4]]</code>. Links remain ordinary plaintext and open as Peeks.</p>`;
  if(!section){section=document.createElement('section');section.className='panel-section linked-scripture';$('#studyDocument').insertAdjacentElement('afterend',section);}
  section.innerHTML=html; wireReferenceButtons();
}

function wireAnnotationActions() {
  $$('[data-annotation-action]').forEach((button)=>button.addEventListener('click',async()=>{
    const item=button.closest('[data-annotation-id]'); const id=item?.dataset.annotationId; if(!id)return;
    const action=button.dataset.annotationAction;
    if(action==='edit'){
      const annotation=(await repo.listAnnotations()).find((x)=>x.id===id); if(!annotation)return;
      const revised=prompt('Edit annotation',annotation.body??''); if(revised===null)return;
      await annotationService.update(id,{body:revised.trim()}); await currentStudy&&studyService.touch(currentStudy.id); await renderNotes();
    }
    if(action==='delete'){
      if(!confirm('Delete this anchored annotation?'))return;
      await annotationService.remove(id); await currentStudy&&studyService.touch(currentStudy.id); await renderScripture(); await renderNotes();
    }
  }));
}

function scheduleDocumentSave(value) {
  setSaving(true); clearTimeout(noteSaveTimer);
  noteSaveTimer=setTimeout(async()=>{
    const study=await ensureStudy();
    await repo.putStudyDocument({studyId:study.id,format:'plaintext',document:null,plainText:value,updatedAt:Date.now()});
    await studyService.touch(study.id); setSaving(false);
  },300);
}

async function renderReferences() {
  elements.studyContent.innerHTML='<div class="loading">Loading references…</div>';
  try {
    const [refs,backlinks]=await Promise.all([researchProvider.forPassage(currentScripture.passage),researchProvider.backlinksForPassage(currentScripture.passage)]);
    elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">SCRIPTURE CONNECTIONS</span><h2>${escapeHtml(formatPassage(currentScripture.passage))}</h2><p class="panel-lede">Explore both directions of the reference network while the primary passage stays fixed.</p><section class="panel-section"><h3>From this passage</h3><div>${refs.map(referenceButtonHtml).join('')||'<p class="quiet">No outgoing references available.</p>'}</div></section><section class="panel-section"><h3>Referenced by</h3><div>${backlinks.map(backlinkButtonHtml).join('')||'<p class="quiet">No incoming references are indexed for this passage.</p>'}</div></section></section>`;
    wireReferenceButtons();
  } catch(error){ renderToolError('References unavailable',error); }
}

async function renderWords() {
  const strongs = selectedToken?.strongs ?? selectedLexicalKey;
  if (!strongs) {
    elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">WORD STUDY</span><h2>Select an aligned word</h2><p class="panel-lede">Tap a word in Scripture that has original-language alignment, or choose an important lexical key from the Guide. Selah shows lexical, morphology, and concordance evidence without treating a gloss as the meaning of the whole verse.</p><p class="warning">The bundled development fixture does not include Strong’s alignment. Run the full BSB data vendoring command to activate this layer.</p></section>`;
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
  const result=await translations.compare(currentScripture.passage,translations.list().map((x)=>x.id));
  elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">COMPARE</span><h2>${escapeHtml(formatPassage(currentScripture.passage))}</h2><p class="panel-lede">Selah only displays translations whose redistribution rights are configured. BSB is the built-in public-domain translation.</p><div class="compare-grid">${result.translations.map(({metadata,scripture})=>`<section class="translation-block"><h3>${escapeHtml(metadata.abbreviation)}</h3><p>${scripture.verses.map((v)=>`<sup>${v.ref.verse}</sup> ${escapeHtml(v.tokens.map((t)=>t.text).join(''))}`).join(' ')}</p></section>`).join('')}</div></section>`;
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
  $$('[data-phrase-action]').forEach((button)=>button.addEventListener('click',async()=>{
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
  $$('[data-label-id]').forEach((input)=>input.addEventListener('change',async()=>{if(!phrasingDocument)return;phrasingDocument={...phrasingDocument,roots:updatePhraseNode(phrasingDocument.roots,input.dataset.labelId,{label:input.value}),updatedAt:Date.now()};await repo.putPhrasingDocument(phrasingDocument);}));
}

async function renderResources() {
  const guide=await guideService.build(currentScripture);
  elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">EXTERNAL RESOURCES</span><h2>${escapeHtml(formatPassage(currentScripture.passage))}</h2><p class="panel-lede">Open trusted external tools only when you deliberately want them. Selah keeps commentary secondary to your own observation of the text.</p>${guide.resources.map(({resource,url})=>resourceLinkHtml(resource,url)).join('')}<section class="resource-attribution"><h3>Data & licenses</h3><a class="resource-link" href="./data/bsb/ATTRIBUTION.md" target="_blank" rel="noopener noreferrer"><span><strong>Bundled Scripture & research data</strong><small>View source attribution and licenses</small></span><span aria-hidden="true">↗</span></a></section></section>`;
}

async function renderActiveTab() {
  $('.tab').forEach((tab)=>{
    const active=tab.dataset.tab===activeTab;
    tab.classList.toggle('active',active);
    tab.setAttribute('aria-selected',String(active));
    tab.tabIndex=active?0:-1;
  });
  elements.studyContent.setAttribute('aria-labelledby',`tab-${activeTab}`);
  if(!currentScripture)return;
  if(activeTab==='guide')return renderGuide();
  if(activeTab==='notes')return renderNotes();
  if(activeTab==='references')return renderReferences();
  if(activeTab==='words')return renderWords();
  if(activeTab==='compare')return renderCompare();
  if(activeTab==='phrasing')return renderPhrasing();
  if(activeTab==='resources')return renderResources();
}

function renderToolError(title,error){elements.studyContent.innerHTML=`<div class="error-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(error instanceof Error?error.message:String(error))}</div>`;}
function wireReferenceButtons(root=document){[...root.querySelectorAll('[data-reference]')].forEach((button)=>button.addEventListener('click',()=>openPeek(parseReference(button.dataset.reference).passage)));}
function wireLexicalButtons(){$$('.lexical-key').forEach((button)=>button.addEventListener('click',async()=>{selectedLexicalKey=button.dataset.strongs;selectedToken=undefined;activeTab='words';await renderActiveTab();}));}
function wireSectionJumps(){$$('.section-jump').forEach((button)=>button.addEventListener('click',()=>{$(`.verse[data-book="${currentScripture.passage.start.book}"][data-chapter="${currentScripture.passage.start.chapter}"][data-verse="${button.dataset.verse}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});}));}

async function openPeek(passage) {
  activePeekPassage=passage; elements.peekTitle.textContent=formatPassage(passage); elements.peek.hidden=false; elements.peekText.textContent='Loading…';
  try {
    const scripture=await scriptureProvider.getPassage(passage);
    const [refs,backlinks]=await Promise.all([researchProvider.forPassage(passage),researchProvider.backlinksForPassage(passage)]);
    const text=scripture.verses.map((v)=>`<p class="peek-verse"><sup>${v.ref.verse}</sup> ${escapeHtml(v.tokens.map((t)=>t.text).join(''))}</p>`).join('');
    const outgoing=refs.slice(0,6).map(referenceButtonHtml).join('');
    const incoming=backlinks.slice(0,6).map(backlinkButtonHtml).join('');
    elements.peekText.innerHTML=`<div class="peek-scripture">${text}</div>${outgoing||incoming?`<div class="peek-connections">${outgoing?`<section><h4>From here</h4>${outgoing}</section>`:''}${incoming?`<section><h4>Referenced by</h4>${incoming}</section>`:''}</div>`:''}`;
    wireReferenceButtons(elements.peekText);
  }
  catch { elements.peekText.textContent='This reference is not installed in the current development data fixture. It will resolve after the complete BSB dataset is vendored.'; }
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

async function renderStudies(filter='') {
  const q=filter.trim().toLowerCase();
  const studies=(await repo.listStudies())
    .filter((study)=>study.archived===showArchivedStudies)
    .filter((study)=>(study.title??formatPassage(study.primaryPassage)).toLowerCase().includes(q));
  const studyRow=(study)=>`<article class="study-row" data-study-id="${study.id}"><button class="study-open" type="button"><strong>${escapeHtml(study.title??formatPassage(study.primaryPassage))}</strong><span>${escapeHtml(formatPassage(study.primaryPassage))} · ${new Date(study.updatedAt).toLocaleDateString()}</span></button><div class="study-actions"><button type="button" data-study-action="rename">Rename</button><button type="button" data-study-action="archive-toggle">${showArchivedStudies?'Restore':'Archive'}</button></div></article>`;
  let html='';
  if(studies.length && q) {
    html=studies.sort((a,b)=>b.updatedAt-a.updatedAt).map(studyRow).join('');
  } else if(studies.length) {
    const groups=new Map();
    for(const study of studies) {
      const bookId=study.primaryPassage.start.book;
      const list=groups.get(bookId)??[];
      list.push(study);
      groups.set(bookId,list);
    }
    html=BOOKS.filter((book)=>groups.has(book.id)).map((book)=>{
      const items=groups.get(book.id).sort((a,b)=>compareVerseRefs(a.primaryPassage.start,b.primaryPassage.start)||compareVerseRefs(a.primaryPassage.end,b.primaryPassage.end));
      return `<section class="study-book-group"><header><strong>${escapeHtml(book.name)}</strong><span>${items.length}</span></header>${items.map(studyRow).join('')}</section>`;
    }).join('');
  } else {
    html=`<p class="quiet">${showArchivedStudies?'No archived studies.':'No saved studies yet. Selah creates one when you first write or annotate.'}</p>`;
  }
  elements.studiesList.innerHTML=html;
  $$('.study-open').forEach((button)=>button.addEventListener('click',async()=>{
    const row=button.closest('[data-study-id]');
    const study=await repo.getStudy(row.dataset.studyId);
    if(!study)return;
    currentStudy=study;
    const existing=(await repo.listWorkspaces()).find((x)=>x.studyId===study.id);
    workspace=existing??await workspaceService.create(study.primaryPassage,'BSB',study.id);
    await workspaceService.markLastOpened(workspace);
    await setCurrentScripture(await scriptureProvider.getPassage(workspace.primaryPassage));
    elements.studiesDrawer.hidden=true;
  }));
  $$('[data-study-action]').forEach((button)=>button.addEventListener('click',async()=>{
    const row=button.closest('[data-study-id]');
    const id=row?.dataset.studyId;
    if(!id)return;
    if(button.dataset.studyAction==='rename'){
      const study=await repo.getStudy(id);
      if(!study)return;
      const next=prompt('Rename study',study.title??formatPassage(study.primaryPassage));
      if(next===null)return;
      try{
        const updated=await studyService.rename(id,next);
        if(currentStudy?.id===id)currentStudy=updated;
        await renderStudies(elements.studySearch.value);
        toast('Study renamed.');
      }catch(error){toast(error instanceof Error?error.message:'Unable to rename study');}
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
$('#studyTabs').addEventListener('click',async(event)=>{const tab=event.target.closest('[data-tab]');if(!tab)return;activeTab=tab.dataset.tab;await renderActiveTab();if(matchMedia('(max-width:760px)').matches)$('#studyPane').classList.add('open');});
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
$('#studiesBtn').addEventListener('click',async()=>{elements.studiesDrawer.hidden=false;await renderStudies();});
$('#drawerClose').addEventListener('click',()=>elements.studiesDrawer.hidden=true);
elements.studySearch.addEventListener('input',()=>renderStudies(elements.studySearch.value));
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
$('#peekClose').addEventListener('click',()=>elements.peek.hidden=true);
$('#peekOpen').addEventListener('click',async()=>{if(activePeekPassage){elements.peek.hidden=true;await navigateResearch(activePeekPassage);}});
$('#exportBtn').addEventListener('click',()=>elements.exportDialog.showModal());
$('#copyExportBtn').addEventListener('click',async()=>{if(!currentStudy){toast('Write or annotate first so there is a study to export.');return;}const markdown=exportStudyContextMarkdown({study:currentStudy,scripture:currentScripture,annotations:await annotationService.forPassage(currentScripture.passage,currentScripture.translationId,currentStudy.id),document:await repo.getStudyDocument(currentStudy.id),options:{includeScripture:$('#exportScripture').checked,includeAnnotations:$('#exportAnnotations').checked,includeDocument:$('#exportDocument').checked,tutorPrompt:$('#exportTutor').value}});await navigator.clipboard.writeText(markdown);elements.exportDialog.close();toast('Study context copied.');});

elements.scripture.addEventListener('click',async(event)=>{
  const verseButton=event.target.closest('.verse-number');if(verseButton){const verse=verseButton.closest('.verse');context.patch({activeVerse:{book:verse.dataset.book,chapter:Number(verse.dataset.chapter),verse:Number(verse.dataset.verse)}});return;}
  const tokenEl=event.target.closest('[data-token-id]');if(tokenEl){selectedToken=tokenById(tokenEl.dataset.tokenId); selectedLexicalKey=selectedToken?.strongs;const verse=verseByTokenId(tokenEl.dataset.tokenId);if(verse)context.patch({activeVerse:verse.ref,selection:{range:{start:verse.ref,end:verse.ref},text:selectedToken.text,tokenIds:[selectedToken.id]}});}
});

elements.scripture.addEventListener('pointerup',()=>{setTimeout(()=>{selectedRangeInfo=selectedTokenRange();if(!selectedRangeInfo){elements.selectionMenu.hidden=true;return;}const selection=getSelection();const rect=selection.getRangeAt(0).getBoundingClientRect();elements.selectionMenu.style.left=`${Math.max(8,Math.min(innerWidth-290,rect.left+rect.width/2-120))}px`;elements.selectionMenu.style.top=`${Math.max(60,rect.top-68)}px`;elements.selectionMenu.hidden=false;$('#selectionLensMeta').textContent='Loading context…';context.patch({selection:{range:selectedRangeInfo.passage,text:selectedRangeInfo.quotedText,tokenIds:[selectedRangeInfo.startTokenId,selectedRangeInfo.endTokenId]}});updateSelectionLens();},0);});

elements.selectionMenu.addEventListener('click',async(event)=>{const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;elements.selectionMenu.hidden=true;if(action==='note'||action==='question'){pendingAnnotationKind=action;$('#noteDialogTitle').textContent=action==='question'?'Add question':'Add note';elements.noteAnchorLabel.textContent=selectedRangeInfo?.quotedText?`“${selectedRangeInfo.quotedText}”`:formatPassage(selectedRangeInfo.passage);elements.noteBody.value='';elements.noteDialog.showModal();await sleep(0);elements.noteBody.focus();}if(action==='highlight')await highlightSelection();if(action==='word'){const id=selectedRangeInfo?.startTokenId;selectedToken=tokenById(id);activeTab='words';await renderActiveTab();}if(action==='compare'){activeTab='compare';await renderActiveTab();}if(action==='copy'&&selectedRangeInfo)await navigator.clipboard.writeText(selectedRangeInfo.quotedText);});

elements.noteForm.addEventListener('submit',async(event)=>{if(event.submitter?.value==='cancel')return;event.preventDefault();const body=elements.noteBody.value.trim();if(!body)return;await createAnnotationFromSelection(body);elements.noteDialog.close();});

document.addEventListener('pointerdown',(event)=>{if(!elements.selectionMenu.hidden&&!elements.selectionMenu.contains(event.target)&&!elements.scripture.contains(event.target))elements.selectionMenu.hidden=true;});
document.addEventListener('keydown',async(event)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();elements.referenceInput.focus();elements.referenceInput.select();}if(event.altKey&&event.key==='ArrowLeft'){event.preventDefault();$('#backBtn').click();}if(event.altKey&&event.key==='ArrowRight'){event.preventDefault();$('#forwardBtn').click();}if(event.key==='Escape'){elements.peek.hidden=true;elements.studiesDrawer.hidden=true;}});

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
if('serviceWorker'in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
