import { LITERARY_MODE_LABELS, defaultLiteraryMode } from './core/study/observation/index.js';

export function modeControlHtml(passage,override) {
  const automatic=defaultLiteraryMode(passage);
  const current=override??automatic;
  const options=Object.entries(LITERARY_MODE_LABELS).map(([value,label])=>`<option value="${value}"${current===value?' selected':''}>${label}</option>`).join('');
  return `<div class="literary-mode-control"><label for="guideLiteraryMode"><span>Study lens</span><select id="guideLiteraryMode"><option value="auto"${override?'':' selected'}>Auto — ${LITERARY_MODE_LABELS[automatic]}</option>${options}</select></label><p>Book-level default only. Change it when this passage uses a different literary form.</p></div>`;
}


export function promptLabel(category,mode) {
  return category==='literary' ? `${LITERARY_MODE_LABELS[mode]} lens` : category;
}
