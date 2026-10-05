const e=(s='')=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export function connectedReferenceCardHtml({label,detail,reference,studies=[]}){
  const study=studies[0];
  return `<article class="reference-card-wrap"><button class="reference-card" type="button" data-reference="${e(reference)}"><strong>${e(label)}</strong><span>${e(detail)}</span></button>${study?`<div class="reference-personal"><button type="button" data-personal-snapshot="${e(study.id)}">Studied · ${e(study.title||label)}</button>${studies.length>1?`<small>+${studies.length-1}</small>`:''}</div>`:''}</article>`;
}
