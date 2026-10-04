const root = document.documentElement;
const tabs = [...document.querySelectorAll('.tab')];
const panels = [...document.querySelectorAll('.tool-panel')];
const pane = document.getElementById('studyPane');
const notes = ['observations','questions','interpretation','summary'];
const saveState = document.getElementById('saveState');
const key = 'selah.prototype.study.Phil.2.5-11';

function activateTab(name) {
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === name));
  panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === name));
  if (matchMedia('(max-width: 760px)').matches) pane.classList.add('open');
}
tabs.forEach((tab) => tab.addEventListener('click', () => activateTab(tab.dataset.tab)));

const saved = JSON.parse(localStorage.getItem(key) || '{}');
for (const id of notes) {
  const field = document.getElementById(id);
  field.value = saved[id] || '';
  field.addEventListener('input', () => {
    saveState.textContent = 'saving…';
    clearTimeout(field._saveTimer);
    field._saveTimer = setTimeout(() => {
      const current = Object.fromEntries(notes.map((name) => [name, document.getElementById(name).value]));
      localStorage.setItem(key, JSON.stringify(current));
      saveState.textContent = 'saved locally';
    }, 250);
  });
}

const selectionMenu = document.getElementById('selectionMenu');
document.getElementById('scripture').addEventListener('mouseup', () => {
  const selection = getSelection();
  const text = selection?.toString().trim();
  if (!text) return selectionMenu.hidden = true;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  selectionMenu.style.left = `${Math.max(8, Math.min(innerWidth - 285, rect.left + rect.width / 2 - 120))}px`;
  selectionMenu.style.top = `${Math.max(64, rect.top - 45)}px`;
  selectionMenu.hidden = false;
});
document.addEventListener('mousedown', (event) => {
  if (!selectionMenu.contains(event.target) && !document.getElementById('scripture').contains(event.target)) selectionMenu.hidden = true;
});
selectionMenu.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.action === 'note') activateTab('notes');
  if (button.dataset.action === 'word') activateTab('words');
  if (button.dataset.action === 'compare') alert('Translation comparison is a provider-driven V1 module; this prototype intentionally does not fake unavailable licensed translations.');
  if (button.dataset.action === 'highlight') {
    const sel = getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      if (!range.collapsed) {
        const mark = document.createElement('mark');
        try { range.surroundContents(mark); } catch {}
      }
    }
  }
  selectionMenu.hidden = true;
});

document.querySelectorAll('.verse-number').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.verse').forEach((verse) => verse.classList.remove('selected-verse'));
  button.closest('.verse').classList.add('selected-verse');
}));

document.querySelectorAll('[data-ref]').forEach((button) => button.addEventListener('click', () => {
  document.getElementById('peekTitle').textContent = button.dataset.ref;
  const text = {
    'Isaiah 45:23': 'By Myself I have sworn; truth has gone out from My mouth, a word that will not be revoked: Every knee will bow before Me, every tongue will swear allegiance.',
    'Romans 14:11': 'It is written: “As surely as I live, says the Lord, every knee will bow before Me; every tongue will confess to God.”',
    '2 Corinthians 8:9': 'Though He was rich, yet for your sakes He became poor, so that you through His poverty might become rich.',
    'John 13:12–17': 'Jesus turns His act of washing the disciples’ feet into a pattern of humble service.'
  }[button.dataset.ref] || 'Reference preview.';
  document.getElementById('peekText').textContent = text;
  document.getElementById('peek').hidden = false;
}));
document.getElementById('peekClose').addEventListener('click', () => document.getElementById('peek').hidden = true);

document.getElementById('patternsBtn').addEventListener('click', (event) => {
  event.currentTarget.classList.toggle('active');
  document.querySelectorAll('.verse').forEach((verse) => verse.classList.toggle('pattern'));
});
document.getElementById('phrasingBtn').addEventListener('click', () => {
  activateTab('notes');
  document.getElementById('observations').value ||= 'Phrasing view will preserve Scripture tokens while allowing line breaks, indentation, grouping, and relationship labels.';
  document.getElementById('observations').focus();
});
document.getElementById('focusBtn').addEventListener('click', (event) => {
  document.body.classList.toggle('reading-focus');
  event.currentTarget.classList.toggle('active');
});

document.getElementById('themeBtn').addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
});

document.getElementById('studiesBtn').addEventListener('click', () => document.getElementById('studiesDrawer').hidden = false);
document.getElementById('drawerClose').addEventListener('click', () => document.getElementById('studiesDrawer').hidden = true);

document.querySelectorAll('.section-title').forEach((button) => button.addEventListener('click', () => {
  const body = button.nextElementSibling;
  const collapsed = body.hidden;
  body.hidden = !collapsed;
  button.lastElementChild.textContent = collapsed ? '−' : '+';
}));

const divider = document.getElementById('divider');
let dragging = false;
divider.addEventListener('mousedown', () => dragging = true);
addEventListener('mouseup', () => dragging = false);
addEventListener('mousemove', (event) => {
  if (!dragging || innerWidth <= 760) return;
  const pct = Math.max(38, Math.min(72, event.clientX / innerWidth * 100));
  root.style.setProperty('--bible-width', `${pct}%`);
});

document.getElementById('referenceForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = document.getElementById('referenceInput').value.trim();
  if (!/^phil(?:ippians)?\s*2(?::5(?:[–-]11)?)?$/i.test(value)) {
    alert('The production reference engine already parses all 66 books; this visual prototype ships only the Philippians 2:5–11 fixture.');
  }
});

if (matchMedia('(max-width: 760px)').matches) {
  document.querySelector('.study-tabs').addEventListener('click', () => pane.classList.add('open'));
  document.querySelector('.bible-pane').addEventListener('click', (event) => {
    if (!event.target.closest('.verse-number') && pane.classList.contains('open')) pane.classList.remove('open');
  });
}
