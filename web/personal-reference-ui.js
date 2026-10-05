const e=(s='')=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

export function personalStudyLinksHtml(studies=[],fallbackLabel='',limit=3){
  const unique=[];
  const seen=new Set();
  for(const study of studies){
    if(!study?.id||seen.has(study.id))continue;
    seen.add(study.id);
    unique.push(study);
  }
  if(!unique.length)return '';
  const visibleLimit=Math.max(1,limit);
  const studyButton=(study,overflow=false)=>`<button type="button" data-personal-snapshot="${e(study.id)}"${overflow?' data-personal-overflow hidden':''}>Studied · ${e(study.title||fallbackLabel)}</button>`;
  const visible=unique.slice(0,visibleLimit).map((study)=>studyButton(study)).join('');
  const overflow=unique.slice(visibleLimit).map((study)=>studyButton(study,true)).join('');
  const remaining=Math.max(0,unique.length-visibleLimit);
  const expand=remaining>0?`<button type="button" data-personal-expand aria-expanded="false" aria-label="Show ${remaining} more prior studies">+${remaining} more</button>`:'';
  return `<div class="reference-personal">${visible}${overflow}${expand}</div>`;
}

export function connectedReferenceCardHtml({label,detail,reference,studies=[]}){
  return `<article class="reference-card-wrap"><button class="reference-card" type="button" data-reference="${e(reference)}"><strong>${e(label)}</strong><span>${e(detail)}</span></button>${personalStudyLinksHtml(studies,label)}</article>`;
}

export function wirePersonalStudyReferences(root,openSnapshot){
  root.querySelectorAll('[data-personal-snapshot]').forEach((button)=>button.addEventListener('click',(event)=>{
    event.stopPropagation();
    openSnapshot(button.dataset.personalSnapshot);
  }));
  root.querySelectorAll('[data-personal-expand]').forEach((button)=>button.addEventListener('click',(event)=>{
    event.stopPropagation();
    const group=button.closest('.reference-personal');
    if(!group)return;
    group.querySelectorAll('[data-personal-overflow]').forEach((item)=>{item.hidden=false;});
    button.setAttribute('aria-expanded','true');
    button.remove();
  }));
}
