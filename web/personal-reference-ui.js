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
  const visible=unique.slice(0,Math.max(1,limit));
  const links=visible.map((study)=>`<button type="button" data-personal-snapshot="${e(study.id)}">Studied · ${e(study.title||fallbackLabel)}</button>`).join('');
  const remaining=unique.length-visible.length;
  return `<div class="reference-personal">${links}${remaining>0?`<small>+${remaining} more</small>`:''}</div>`;
}

export function connectedReferenceCardHtml({label,detail,reference,studies=[]}){
  return `<article class="reference-card-wrap"><button class="reference-card" type="button" data-reference="${e(reference)}"><strong>${e(label)}</strong><span>${e(detail)}</span></button>${personalStudyLinksHtml(studies,label)}</article>`;
}
