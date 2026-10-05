const esc=(value='')=>String(value).replace(/[&<>'"]/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));

export function connectedReferenceCardHtml({label,detail,reference,studies=[]}) {
  const personal=studies.length
    ? `<div class="reference-personal">${studies.slice(0,2).map((study)=>`<span class="reference-study"><button type="button" data-personal-snapshot="${esc(study.id)}">Studied</button><button type="button" data-personal-study="${esc(study.id)}">${esc(study.title||'Open study')}</button></span>`).join('')}${studies.length>2?`<small>+${studies.length-2} more</small>`:''}</div>`
    : '';
  return `<article class="reference-card-wrap"><button class="reference-card" type="button" data-reference="${esc(reference)}"><strong>${esc(label)}</strong><span>${esc(detail)}</span></button>${personal}</article>`;
}

export function wirePersonalReferenceActions(root,{openSnapshot,openStudy}) {
  root.querySelectorAll('[data-personal-snapshot]').forEach((button)=>button.addEventListener('click',(event)=>{event.stopPropagation();openSnapshot(button.dataset.personalSnapshot);}));
  root.querySelectorAll('[data-personal-study]').forEach((button)=>button.addEventListener('click',(event)=>{event.stopPropagation();openStudy(button.dataset.personalStudy);}));
}
