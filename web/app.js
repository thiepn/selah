import { parseReference, formatPassage, canonicalPassageId, BOOK_BY_ID, VerseBoundsIndex } from './core/domain/references/index.js';
import { PassageContextStore } from './core/domain/context/index.js';
import { createResearchTrail, extractStudyDocumentScriptureLinks } from './core/domain/studies/index.js';
import { IndexedDbSelahRepository, createBackup, parseBackup } from './core/persistence/index.js';
import { BsbScriptureProvider, FetchTextAssetLoader, BsbResearchProvider } from './core/data/bsb/index.js';
import { AnnotationService } from './core/annotations/index.js';
import { StudyService, WorkspaceService } from './core/study/index.js';
import { LensService } from './core/study/lens/index.js';
import { PassageGuideService } from './core/study/guide/index.js';
import { OriginalLanguageService } from './core/research/original-language/index.js';
import { TranslationRegistry } from './core/research/compare/index.js';
import { analyzePatterns } from './core/bible/patterns/index.js';
import { indentPhrase, outdentPhrase, updatePhraseNode, splitPhraseNode, mergePhraseWithPrevious } from './core/bible/phrasing/index.js';
import { exportStudyContextMarkdown } from './core/export/index.js';
import { ScriptureSearchIndex, PersonalStudySearchIndex } from './core/search/index.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
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
const guideService = new PassageGuideService(annotationService, researchProvider);
const lensService = new LensService(annotationService, researchProvider);
const originalLanguage = new OriginalLanguageService(scriptureProvider, researchProvider, researchProvider, researchProvider);
const translations = new TranslationRegistry([scriptureProvider]);

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
let scriptureSearchIndexPromise;
let verseBoundsPromise;

const defaultPassage = parseReference('Phil 2:5-11').passage;
workspace = await workspaceService.restoreLast();
if (!workspace) workspace = await workspaceService.create(defaultPassage);
const context = new PassageContextStore({ primaryPassage: workspace.primaryPassage, translationId: workspace.translationId });

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

async function renderSearchResults(query) {
  elements.studyContent.innerHTML='<div class="loading">Searching Scripture and studies…</div>';
  const [scriptureIndex,snapshot]=await Promise.all([loadScriptureSearchIndex().catch(()=>undefined),repo.exportSnapshot()]);
  const personal=new PersonalStudySearchIndex(); personal.rebuild({studies:snapshot.studies,documents:snapshot.studyDocuments,annotations:snapshot.annotations});
  const scriptureResults=scriptureIndex?.search(query,30)??[]; const personalResults=personal.search(query,30);
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
  } else {
    workspace = { ...workspace, primaryPassage: structuredClone(scripture.passage), studyId: currentStudy?.id, researchTrail:createResearchTrail({passage:scripture.passage}), updatedAt:Date.now() };
    if (!currentStudy) delete workspace.studyId;
  }
  await repo.putWorkspace(workspace);
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
  await renderScripture();
  await renderActiveTab();
  updateHistoryButtons();
}

async function loadInitial() {
  try {
    const scripture = await scriptureProvider.getPassage(workspace.primaryPassage);
    currentStudy = workspace.studyId ? await repo.getStudy(workspace.studyId) : await getStudyForPassage(scripture.passage);
    await setCurrentScripture(scripture);
  } catch (error) {
    console.warn(error);
    workspace = await workspaceService.create(defaultPassage);
    const scripture = await scriptureProvider.getPassage(defaultPassage);
    await setCurrentScripture(scripture);
  }
}

async function ensureStudy() {
  if (currentStudy) return currentStudy;
  currentStudy = await studyService.create(currentScripture.passage);
  workspace = { ...workspace, studyId:currentStudy.id, updatedAt:Date.now() };
  await repo.putWorkspace(workspace);
  await workspaceService.markLastOpened(workspace);
  return currentStudy;
}

function updateHistoryButtons() {
  $('#backBtn').disabled = workspace.researchTrail.index <= 0;
  $('#forwardBtn').disabled = workspace.researchTrail.index >= workspace.researchTrail.entries.length-1;
}

function tokenById(id) {
  for (const verse of currentScripture?.verses ?? []) {
    const token = verse.tokens.find((candidate)=>candidate.id===id);
    if (token) return token;
  }
}

function verseByTokenId(id) {
  return currentScripture?.verses.find((verse)=>verse.tokens.some((token)=>token.id===id));
}

async function renderScripture() {
  if (!currentScripture) return;
  const annotations = await annotationService.forPassage(currentScripture.passage,currentScripture.translationId,currentStudy?.id);
  const highlightedIds = new Set();
  const noteVerses = new Set();
  for (const annotation of annotations) {
    if (annotation.anchor.type==='text') {
      const verse=currentScripture.verses.find((x)=>x.ref.book===annotation.anchor.verse.book&&x.ref.chapter===annotation.anchor.verse.chapter&&x.ref.verse===annotation.anchor.verse.verse);
      if (verse) {
        const ids=verse.tokens.map((x)=>x.id); const a=ids.indexOf(annotation.anchor.startTokenId); const b=ids.indexOf(annotation.anchor.endTokenId);
        if (annotation.kind==='highlight'&&a>=0&&b>=0) for (let i=Math.min(a,b);i<=Math.max(a,b);i++) highlightedIds.add(ids[i]);
        if (annotation.kind==='note'||annotation.kind==='question') noteVerses.add(verse.ref.verse);
      }
    }
    if (annotation.anchor.type==='reference') for(let v=annotation.anchor.passage.start.verse;v<=annotation.anchor.passage.end.verse;v++)noteVerses.add(v);
  }
  const grouped=new Map();
  for(const verse of currentScripture.verses){const arr=grouped.get(verse.ref.chapter)??[];arr.push(verse);grouped.set(verse.ref.chapter,arr);}
  let html='';
  for(const [chapter,verses] of grouped){
    html += `<h1>${escapeHtml(BOOK_BY_ID.get(verses[0].ref.book)?.name??verses[0].ref.book)} ${chapter}</h1>`;
    for(const verse of verses){
      if(verse.heading) html += `<p class="section-heading">${escapeHtml(verse.heading)}</p>`;
      html += `<p class="verse${noteVerses.has(verse.ref.verse)?' has-note':''}" data-book="${verse.ref.book}" data-chapter="${verse.ref.chapter}" data-verse="${verse.ref.verse}"><button class="verse-number" type="button" aria-label="Verse ${verse.ref.verse}">${verse.ref.verse}</button><span>${verse.tokens.map((token)=>`<span class="token${highlightedIds.has(token.id)?' annotation-highlight':''}${patternTokenIds.has(token.id)?' pattern-hit':''}" data-token-id="${escapeHtml(token.id)}"${token.strongs?` data-strongs="${escapeHtml(token.strongs)}"`:''}>${escapeHtml(token.text)}</span>`).join('')}</span></p>`;
    }
  }
  elements.scripture.innerHTML=html;
}

function setActiveTabUi() {
  $$('#studyTabs .tab').forEach((button)=>button.classList.toggle('active',button.dataset.tab===activeTab));
}

async function renderActiveTab() {
  if (!currentScripture) return;
  setActiveTabUi();
  elements.studyContent.innerHTML='<div class="loading">Loading study context…</div>';
  try {
    if(activeTab==='guide') await renderGuide();
    else if(activeTab==='notes') await renderNotes();
    else if(activeTab==='references') await renderReferences();
    else if(activeTab==='words') await renderWords();
    else if(activeTab==='compare') await renderCompare();
    else if(activeTab==='resources') await renderResources();
    else if(activeTab==='phrasing') await renderPhrasing();
  } catch(error) {
    console.error(error);
    elements.studyContent.innerHTML=`<div class="error-state"><strong>Study tool unavailable</strong>${escapeHtml(error instanceof Error?error.message:String(error))}</div>`;
  }
}

async function renderGuide() {
  const guide=await guideService.build(currentScripture);
  const lens=await lensService.forPassage(currentScripture);
  elements.studyContent.innerHTML=`<section class="panel"><header class="panel-header"><div><span class="eyebrow">PASSAGE GUIDE</span><h2>${escapeHtml(formatPassage(currentScripture.passage))}</h2></div><span class="quiet">follows passage</span></header><div class="metric-row"><span class="metric">${guide.crossReferences.length} references</span><span class="metric">${guide.annotations.length} notes</span><span class="metric">${guide.patterns.length} patterns</span><span class="metric">${lens.lexicalKeys.length} lexical keys</span></div><section class="panel-section"><h3>Context</h3><p class="panel-lede">Stay anchored in the current literary unit before leaving it for secondary resources.</p>${guide.sections.length?`<div class="passage-sections"><div class="mini-label">Textual structure</div>${guide.sections.map((section)=>`<button class="section-jump" type="button" data-verse="${section.verse}"><span>v. ${section.verse}</span><strong>${escapeHtml(section.heading)}</strong></button>`).join('')}</div>`:''}</section><section class="panel-section"><h3>Cross-references</h3>${guide.crossReferences.slice(0,8).map((x)=>referenceButton(x.target)).join('')||'<p class="quiet">No bundled references for this passage.</p>'}</section><section class="panel-section"><h3>Important words</h3>${guide.importantLexicalKeys.map((key)=>`<button class="word-card guide-word" type="button" data-strongs="${escapeHtml(key)}"><strong>${escapeHtml(key)}</strong><span>Investigate usage and morphology</span></button>`).join('')||'<p class="quiet">Select a word in Scripture to investigate it.</p>'}</section><section class="panel-section"><h3>Your material</h3>${guide.annotations.length?`${guide.annotations.slice(0,5).map(annotationHtml).join('')}`:'<p class="quiet">No notes anchored here yet.</p>'}</section><section class="panel-section"><h3>Resources</h3>${guide.resources.map(({resource,url})=>`<a class="resource-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><strong>${escapeHtml(resource.name)}</strong><small>${escapeHtml(resource.category)} ↗</small></a>`).join('')}</section></section>`;
  bindReferenceButtons();
  bindAnnotationActions();
  $$('.section-jump').forEach((button)=>button.addEventListener('click',()=>{const verse=elements.scripture.querySelector(`.verse[data-verse="${button.dataset.verse}"]`);verse?.scrollIntoView({behavior:'smooth',block:'center'});verse?.querySelector('.verse-number')?.focus();}));
  $$('.guide-word').forEach((button)=>button.addEventListener('click',async()=>{selectedLexicalKey=button.dataset.strongs;selectedToken=undefined;activeTab='words';await renderActiveTab();}));
}

function referenceButton(passage) {
  return `<button class="reference-card" type="button" data-reference="${escapeHtml(formatPassage(passage))}"><strong>${escapeHtml(formatPassage(passage))}</strong><span>Peek without losing the current passage</span></button>`;
}

function annotationHtml(a) {
  const anchor=a.anchor.type==='reference'?formatPassage(a.anchor.passage):a.anchor.type==='text'?`“${a.anchor.quotedText}”`:'Original text';
  return `<article class="annotation-item" data-annotation-id="${escapeHtml(a.id)}"><div class="annotation-heading"><div><span class="annotation-kind">${escapeHtml(a.kind)}</span><span class="annotation-anchor">${escapeHtml(anchor)}</span></div><div class="annotation-actions">${a.kind!=='highlight'?'<button type="button" data-edit-annotation>Edit</button>':''}<button type="button" data-delete-annotation>Delete</button></div></div>${a.body?`<p>${escapeHtml(a.body)}</p>`:''}</article>`;
}

function bindAnnotationActions() {
  $$('[data-delete-annotation]').forEach((button)=>button.addEventListener('click',async()=>{const id=button.closest('[data-annotation-id]')?.dataset.annotationId;if(!id)return;if(!confirm('Delete this annotation?'))return;await annotationService.remove(id);toast('Annotation deleted.');await renderScripture();await renderActiveTab();}));
  $$('[data-edit-annotation]').forEach((button)=>button.addEventListener('click',async()=>{const id=button.closest('[data-annotation-id]')?.dataset.annotationId;if(!id)return;const annotation=(await repo.listAnnotations()).find((item)=>item.id===id);if(!annotation)return;const body=prompt(annotation.kind==='question'?'Edit question':'Edit note',annotation.body??'');if(body===null)return;await annotationService.update(id,{body:body.trim()});toast('Annotation updated.');await renderActiveTab();}));
}

async function renderNotes() {
  const annotations=await annotationService.forPassage(currentScripture.passage,currentScripture.translationId,currentStudy?.id);
  const document=currentStudy?await repo.getStudyDocument(currentStudy.id):undefined;
  const links=document?extractStudyDocumentScriptureLinks(document.plainText):[];
  elements.studyContent.innerHTML=`<section class="panel"><header class="panel-header"><div><span class="eyebrow">STUDY DOCUMENT</span><h2>${escapeHtml(currentStudy?.title??formatPassage(currentScripture.passage))}</h2></div><span id="saveState" class="quiet">saved locally</span></header><textarea id="studyDocument" class="study-document" placeholder="Write freely. Suggested headings:&#10;&#10;Observations&#10;Questions&#10;Structure&#10;Context&#10;Interpretation&#10;Connections&#10;Summary">${escapeHtml(document?.plainText??'')}</textarea><p class="panel-lede">Use <code>[[Romans 8:1-4]]</code> to create a Scripture link without turning Selah into a PKM system.</p><section class="panel-section linked-scripture"><h3>Linked Scripture</h3>${links.map((link)=>`<button class="reference-card" type="button" data-reference="${escapeHtml(formatPassage(link.passage))}"><strong>${escapeHtml(formatPassage(link.passage))}</strong><span>${escapeHtml(link.raw)}</span></button>`).join('')||'<p class="quiet">No Scripture links in this document yet.</p>'}</section><section class="panel-section"><h3>Anchored notes</h3><div class="annotation-list">${annotations.map(annotationHtml).join('')||'<p class="quiet">Select Scripture and add a note, question, or highlight.</p>'}</div></section></section>`;
  bindReferenceButtons();
  bindAnnotationActions();
  const textarea=$('#studyDocument');
  textarea.addEventListener('input',()=>{clearTimeout(noteSaveTimer);setSaving(true);noteSaveTimer=setTimeout(async()=>{const study=await ensureStudy();await repo.putStudyDocument({studyId:study.id,format:'plaintext',document:textarea.value,plainText:textarea.value,updatedAt:Date.now()});await studyService.touch(study.id);setSaving(false);},260);});
}

async function renderReferences() {
  const references=await researchProvider.forPassage(currentScripture.passage);
  elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">CROSS-REFERENCES</span><h2>${escapeHtml(formatPassage(currentScripture.passage))}</h2><p class="panel-lede">References open as Peeks first, keeping your primary study fixed.</p><div>${references.map((x)=>referenceButton(x.target)).join('')||'<p class="quiet">No bundled cross-references for this passage.</p>'}</div></section>`;
  bindReferenceButtons();
}

async function renderWords() {
  const verse=selectedToken?verseByTokenId(selectedToken.id):context.get().activeVerse??currentScripture.verses[0]?.ref;
  if(!verse){elements.studyContent.innerHTML='<div class="empty-state">Select a verse or word.</div>';return;}
  const analyses=await originalLanguage.analyzeVerse(verse);
  let shown=selectedLexicalKey?analyses.filter((x)=>x.token.strongs===selectedLexicalKey):(selectedToken?.strongs?analyses.filter((x)=>x.token.strongs===selectedToken.strongs):analyses);
  if(selectedLexicalKey&&!shown.length){
    const [lexicon,occurrences]=await Promise.all([researchProvider.get(selectedLexicalKey),researchProvider.versesForStrongs(selectedLexicalKey)]);
    shown=[{ref:verse,token:{id:`guide:${selectedLexicalKey}`,text:lexicon?.lemma??selectedLexicalKey,strongs:selectedLexicalKey,language:lexicon?.language==='hebrew'?'hbo':'grc'},...(lexicon?{lexicon}:{}),occurrences,occurrenceCount:occurrences.length}];
  }
  elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">WORD STUDY</span><h2>${escapeHtml(formatPassage({start:verse,end:verse}))}</h2><p class="panel-lede">Lexical and morphological data are evidence to investigate, not an automatic interpretation.</p>${shown.map((item)=>`<section class="panel-section"><div class="word-lemma">${escapeHtml(item.token.text)}</div><div class="word-translit">${escapeHtml(item.lexicon?.transliteration??item.token.strongs??'')}</div>${item.lexicon?.gloss?`<p class="word-definition"><strong>Gloss:</strong> ${escapeHtml(item.lexicon.gloss)}</p>`:''}${item.lexicon?.definition?`<p class="word-definition">${escapeHtml(item.lexicon.definition)}</p>`:''}${item.morphology?.morphology?`<div class="metric-row"><span class="metric">${escapeHtml(item.morphology.morphology)}</span>${item.morphology.partOfSpeech?`<span class="metric">${escapeHtml(item.morphology.partOfSpeech)}</span>`:''}</div>`:''}${item.occurrenceCount!==undefined?`<p class="quiet">${item.occurrenceCount} verse occurrences in the bundled concordance</p><div class="occurrence-list">${(item.occurrences??[]).slice(0,24).map((ref)=>referenceButton({start:ref,end:ref})).join('')}</div>`:''}</section>`).join('')||'<p class="quiet">No original-language alignment is available for this verse in the installed data pack.</p>'}<p class="warning">Do not infer a passage's meaning from a gloss alone. Usage, grammar, literary context, and argument remain primary.</p></section>`;
  bindReferenceButtons();
}

async function renderCompare() {
  const result=await translations.compare(currentScripture.passage,['BSB']);
  elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">COMPARE</span><h2>${escapeHtml(formatPassage(currentScripture.passage))}</h2><p class="panel-lede">Selah only bundles translations it may legally redistribute. Additional providers can plug into this surface later.</p><div class="compare-grid">${result.translations.map(({metadata,scripture})=>`<section class="translation-block"><h3>${escapeHtml(metadata.abbreviation)}</h3>${scripture.verses.map((verse)=>`<p><sup>${verse.ref.verse}</sup> ${escapeHtml(verse.tokens.map((t)=>t.text).join(''))}</p>`).join('')}</section>`).join('')}</div></section>`;
}

async function renderResources() {
  const guide=await guideService.build(currentScripture);
  elements.studyContent.innerHTML=`<section class="panel"><span class="eyebrow">RESOURCES</span><h2>Investigate when needed</h2><p class="panel-lede">Secondary resources stay secondary. Read and observe Scripture first.</p>${guide.resources.map(({resource,url})=>`<a class="resource-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><strong>${escapeHtml(resource.name)}</strong><small>${escapeHtml(resource.category)} ↗</small></a>`).join('')}<button id="attributionBtn" class="resource-link" type="button"><strong>Data sources & attribution</strong><small>licenses</small></button><section id="attributionPanel" class="panel-section" hidden></section><button id="copyAiBtn" class="resource-link" type="button"><strong>Copy study context</strong><small>external AI / other tools</small></button></section>`;
  $('#copyAiBtn').addEventListener('click',()=>elements.exportDialog.showModal());
  $('#attributionBtn').addEventListener('click',async()=>{const panel=$('#attributionPanel');panel.hidden=false;panel.innerHTML='<p class="quiet">Loading bundled attribution…</p>';try{const response=await fetch('./data/bsb/ATTRIBUTION.md');const text=response.ok?await response.text():'No attribution file is bundled in this development data pack.';panel.innerHTML=`<pre class="attribution-text">${escapeHtml(text)}</pre>`;}catch{panel.innerHTML='<p class="quiet">Attribution file unavailable.</p>';}});
}

function initialPhraseRoots() {
  return currentScripture.verses.map((verse)=>({id:crypto.randomUUID(),tokenIds:verse.tokens.map((x)=>x.id),label:`v. ${verse.ref.verse}`,children:[]}));
}

function phraseText(node) { return node.tokenIds.map((id)=>tokenById(id)?.text??'').join(''); }

function phraseNodeHtml(node,depth=0) {
  const splitMode=phrasingSplitNodeId===node.id;
  const tokenParts=splitMode?node.tokenIds.map((id,index)=>`${escapeHtml(tokenById(id)?.text??'')}${index<node.tokenIds.length-1?`<button class="phrase-split-marker" type="button" data-phrase-split="${escapeHtml(node.id)}" data-after-token="${escapeHtml(id)}" title="Split after this token">¦</button>`:''}`).join(''):`<span class="phrase-text">${escapeHtml(phraseText(node))}</span>`;
  return `<div class="phrase-node" data-node-id="${escapeHtml(node.id)}" style="margin-left:${depth*18}px"><input class="phrase-label" value="${escapeHtml(node.label??'')}" placeholder="Label this unit" /><div class="${splitMode?'phrase-split-mode':'phrase-text'}">${tokenParts}</div><div class="phrase-toolbar"><button type="button" data-action="indent">Indent</button><button type="button" data-action="outdent">Outdent</button><button type="button" data-action="split">${splitMode?'Cancel split':'Split'}</button><button type="button" data-action="merge">Merge ↑</button></div></div>${node.children.map((child)=>phraseNodeHtml(child,depth+1)).join('')}`;
}

async function savePhrasing() {
  if(!phrasingDocument)return; phrasingDocument={...phrasingDocument,updatedAt:Date.now()};await repo.putPhrasingDocument(phrasingDocument);setSaving(false);
}

async function renderPhrasing() {
  const study=await ensureStudy(); const id=`phrasing:${study.id}:${canonicalPassageId(currentScripture.passage)}`;
  phrasingDocument=await repo.getPhrasingDocument(id)??{id,studyId:study.id,passage:structuredClone(currentScripture.passage),roots:initialPhraseRoots(),updatedAt:Date.now()};
  elements.studyContent.innerHTML=`<section class="panel"><header class="panel-header"><div><span class="eyebrow">PHRASING</span><h2>Structure the passage</h2></div><span id="saveState" class="quiet">saved locally</span></header><p class="panel-lede">Indent, group, label, split, and recombine units without modifying Scripture itself.</p><div id="phraseTree" class="phrase-tree">${phrasingDocument.roots.map((node)=>phraseNodeHtml(node)).join('')}</div></section>`;
  $('#phraseTree').addEventListener('click',async(event)=>{
    const splitMarker=event.target.closest('[data-phrase-split]');if(splitMarker){setSaving(true);phrasingDocument.roots=splitPhraseNode(phrasingDocument.roots,splitMarker.dataset.phraseSplit,splitMarker.dataset.afterToken,crypto.randomUUID());phrasingSplitNodeId=undefined;await savePhrasing();await renderPhrasing();return;}
    const button=event.target.closest('[data-action]');if(!button)return;const id=button.closest('[data-node-id]').dataset.nodeId;setSaving(true);
    if(button.dataset.action==='indent')phrasingDocument.roots=indentPhrase(phrasingDocument.roots,id);
    if(button.dataset.action==='outdent')phrasingDocument.roots=outdentPhrase(phrasingDocument.roots,id);
    if(button.dataset.action==='split'){phrasingSplitNodeId=phrasingSplitNodeId===id?undefined:id;await renderPhrasing();return;}
    if(button.dataset.action==='merge')phrasingDocument.roots=mergePhraseWithPrevious(phrasingDocument.roots,id);
    await savePhrasing();await renderPhrasing();
  });
  $('#phraseTree').addEventListener('change',async(event)=>{if(!event.target.matches('.phrase-label'))return;const id=event.target.closest('[data-node-id]').dataset.nodeId;setSaving(true);phrasingDocument.roots=updatePhraseNode(phrasingDocument.roots,id,{label:event.target.value.trim()||undefined});await savePhrasing();});
}

function bindReferenceButtons() {
  $$('[data-reference]').forEach((button)=>button.addEventListener('click',async()=>{const parsed=parseReference(button.dataset.reference);if(parsed.passage)await openPeek(parsed.passage);}));
}

async function openPeek(passage) {
  activePeekPassage=passage;elements.peek.hidden=false;elements.peekTitle.textContent=formatPassage(passage);elements.peekText.textContent='Loading Scripture…';
  try{const scripture=await scriptureProvider.getPassage(passage);elements.peekText.textContent=scripture.verses.map((v)=>`${v.ref.verse} ${v.tokens.map((t)=>t.text).join('')}`).join('\n');}
  catch{elements.peekText.textContent='This reference is not installed in the current offline data pack.';}
}

async function navigateResearch(passage) {
  workspace=await workspaceService.navigate(workspace,passage);await workspaceService.markLastOpened(workspace);await setCurrentScripture(await scriptureProvider.getPassage(passage));
}

async function renderStudies(query='') {
  const studies=(await repo.listStudies()).sort((a,b)=>b.updatedAt-a.updatedAt);
  const filtered=studies.filter((x)=>!query||(`${x.title??''} ${formatPassage(x.primaryPassage)} ${x.tags.join(' ')}`).toLowerCase().includes(query.toLowerCase()));
  elements.studiesList.innerHTML=filtered.map((study)=>`<article class="study-row" data-study-row="${escapeHtml(study.id)}"><button type="button" class="study-open" data-study-id="${escapeHtml(study.id)}"><strong>${escapeHtml(study.title??formatPassage(study.primaryPassage))}</strong><span>${escapeHtml(formatPassage(study.primaryPassage))}${study.archived?' · archived':''}</span></button><span class="study-actions"><button type="button" data-rename-study title="Rename">Rename</button><button type="button" data-archive-study title="${study.archived?'Restore':'Archive'}">${study.archived?'Restore':'Archive'}</button></span></article>`).join('')||'<p class="quiet">No saved studies yet. A study is created when you first write or annotate.</p>';
  $$('[data-study-id]').forEach((button)=>button.addEventListener('click',async()=>{const study=await repo.getStudy(button.dataset.studyId);if(!study)return;currentStudy=study;let target=(await repo.listWorkspaces()).find((w)=>w.studyId===study.id);workspace=target??await workspaceService.create(study.primaryPassage,'BSB',study.id);await workspaceService.markLastOpened(workspace);elements.studiesDrawer.hidden=true;await setCurrentScripture(await scriptureProvider.getPassage(workspace.primaryPassage));}));
  $$('[data-rename-study]').forEach((button)=>button.addEventListener('click',async()=>{const id=button.closest('[data-study-row]').dataset.studyRow;const study=await repo.getStudy(id);if(!study)return;const next=prompt('Study title',study.title??formatPassage(study.primaryPassage));if(next===null)return;try{await studyService.rename(id,next);if(currentStudy?.id===id)currentStudy=await repo.getStudy(id);await renderStudies(elements.studySearch.value);if(activeTab==='notes')await renderNotes();}catch(error){toast(error instanceof Error?error.message:'Unable to rename study');}}));
  $$('[data-archive-study]').forEach((button)=>button.addEventListener('click',async()=>{const id=button.closest('[data-study-row]').dataset.studyRow;const study=await repo.getStudy(id);if(!study)return;await studyService.setArchived(id,!study.archived);if(currentStudy?.id===id)currentStudy=await repo.getStudy(id);await renderStudies(elements.studySearch.value);toast(study.archived?'Study restored.':'Study archived.');}));
}

function selectedTokenRange() {
  const selection=getSelection();if(!selection?.rangeCount||selection.isCollapsed)return undefined;
  const range=selection.getRangeAt(0);const startEl=range.startContainer.parentElement?.closest?.('[data-token-id]')??(range.startContainer.nodeType===1?range.startContainer.closest?.('[data-token-id]'):undefined);const endEl=range.endContainer.parentElement?.closest?.('[data-token-id]')??(range.endContainer.nodeType===1?range.endContainer.closest?.('[data-token-id]'):undefined);
  if(!startEl||!endEl)return undefined;
  const startVerse=verseByTokenId(startEl.dataset.tokenId);const endVerse=verseByTokenId(endEl.dataset.tokenId);if(!startVerse||!endVerse)return undefined;
  return {passage:{start:startVerse.ref,end:endVerse.ref},startTokenId:startEl.dataset.tokenId,endTokenId:endEl.dataset.tokenId,quotedText:selection.toString().trim(),sameVerse:startVerse.ref.book===endVerse.ref.book&&startVerse.ref.chapter===endVerse.ref.chapter&&startVerse.ref.verse===endVerse.ref.verse};
}

async function togglePatterns() {
  const button=$('#patternsBtn');const on=!button.classList.contains('active');button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));patternTokenIds.clear();
  if(on){for(const pattern of analyzePatterns(currentScripture))for(const occurrence of pattern.occurrences)patternTokenIds.add(occurrence.tokenId);}
  await renderScripture();
}

async function updateSelectionLens() {
  if(!selectedRangeInfo){$('#selectionLensMeta').textContent='';return;}
  try { const passage=await scriptureProvider.getPassage(selectedRangeInfo.passage);const lens=await lensService.forPassage(passage);const lexical=lens.lexicalKeys.length?`${lens.lexicalKeys.length} lexical`:'';$('#selectionLensMeta').textContent=`${lens.crossReferenceCount} refs · ${lens.annotationCount} notes${lexical?` · ${lexical}`:''}`; } catch { $('#selectionLensMeta').textContent='Selection'; }
}

async function createAnnotationFromSelection(body) {
  if(!selectedRangeInfo)return; const study=await ensureStudy(); setSaving(true);
  if(pendingAnnotationKind==='question') await annotationService.createQuestion(selectedRangeInfo.passage,body,study.id);
  else if(selectedRangeInfo.sameVerse) await annotationService.createTextNote({translationId:currentScripture.translationId,verse:selectedRangeInfo.passage.start,startTokenId:selectedRangeInfo.startTokenId,endTokenId:selectedRangeInfo.endTokenId,quotedText:selectedRangeInfo.quotedText,body,studyId:study.id});
  else await annotationService.createReferenceNote(selectedRangeInfo.passage,body,study.id);
  await studyService.touch(study.id);setSaving(false);await renderScripture();if(activeTab==='notes'||activeTab==='guide')await renderActiveTab();
}

async function highlightSelection() {
  if(!selectedRangeInfo?.sameVerse){toast('Multi-verse highlights are not enabled yet; use a passage note instead.');return;}
  const study=await ensureStudy(); await annotationService.createHighlight({translationId:currentScripture.translationId,verse:selectedRangeInfo.passage.start,startTokenId:selectedRangeInfo.startTokenId,endTokenId:selectedRangeInfo.endTokenId,quotedText:selectedRangeInfo.quotedText,studyId:study.id}); await studyService.touch(study.id); await renderScripture();
}

$('#referenceForm').addEventListener('submit',async(event)=>{event.preventDefault();const query=elements.referenceInput.value.trim();try{const scripture=await resolveReferenceInput(query);await switchPrimaryPassage(scripture);}catch(error){if(/Unknown Bible book|Could not parse reference|Reference is empty/.test(error instanceof Error?error.message:'')){await renderSearchResults(query);return;}toast(error instanceof Error?error.message:'Unable to open passage');}});
$('#backBtn').addEventListener('click',async()=>{workspace=await workspaceService.back(workspace);await setCurrentScripture(await scriptureProvider.getPassage(workspace.primaryPassage));});
$('#forwardBtn').addEventListener('click',async()=>{workspace=await workspaceService.forward(workspace);await setCurrentScripture(await scriptureProvider.getPassage(workspace.primaryPassage));});
$('#studyTabs').addEventListener('click',async(event)=>{const tab=event.target.closest('[data-tab]');if(!tab)return;activeTab=tab.dataset.tab;await renderActiveTab();if(matchMedia('(max-width:760px)').matches)$('#studyPane').classList.add('open');});
$('#patternsBtn').addEventListener('click',togglePatterns);
$('#focusBtn').addEventListener('click',(event)=>{document.body.classList.toggle('reading-focus');event.currentTarget.classList.toggle('active');event.currentTarget.setAttribute('aria-pressed',String(event.currentTarget.classList.contains('active')));});
$('#themeBtn').addEventListener('click',async()=>{const settings=await repo.getSettings();const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;await repo.setSettings({...settings,theme:next});});
$('#studiesBtn').addEventListener('click',async()=>{elements.studiesDrawer.hidden=false;await renderStudies();});
$('#drawerClose').addEventListener('click',()=>elements.studiesDrawer.hidden=true);
elements.studySearch.addEventListener('input',()=>renderStudies(elements.studySearch.value));
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
await loadInitial();
if('serviceWorker'in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});