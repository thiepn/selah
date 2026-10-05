import { parseReference, formatPassage } from './core/domain/references/index.js';
import { InterpretationClaimService } from './core/study/claims/index.js';

const esc=(value='')=>value.replace(/[&<>'"]/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
const LABELS={
  explicit:'Explicit in text',
  'strong-inference':'Strong inference',
  tentative:'Tentative',
  disputed:'Disputed',
};

function evidenceRow(item={reference:'',note:''}){
  return `<div class="claim-evidence-row"><label><span>Scripture</span><input data-claim-evidence-ref value="${esc(item.reference)}" placeholder="Philippians 2:6–8"></label><label><span>Why it supports the claim</span><input data-claim-evidence-note value="${esc(item.note)}" maxlength="500" placeholder="Optional evidence note"></label><button class="icon-button" data-claim-evidence-remove type="button" aria-label="Remove evidence">×</button></div>`;
}

function claimHtml(claim){
  const evidence=claim.evidence.length
    ? `<div class="claim-evidence">${claim.evidence.map((item)=>`<div><button type="button" data-reference="${esc(formatPassage(item.passage))}">${esc(formatPassage(item.passage))}</button>${item.note?`<p>${esc(item.note)}</p>`:''}</div>`).join('')}</div>`
    : '<p class="quiet">No textual evidence attached yet.</p>';
  return `<article class="interpretation-claim" data-claim-id="${esc(claim.id)}"><div class="claim-head"><span class="claim-confidence ${esc(claim.confidence)}">${esc(LABELS[claim.confidence]??claim.confidence)}</span><div><button class="text-button" data-claim-action="edit" type="button">Edit</button><button class="text-button" data-claim-action="delete" type="button">Delete</button></div></div><p class="claim-statement">${esc(claim.statement)}</p>${evidence}</article>`;
}

export async function claimsUI(container,repo,studyService,currentStudy,currentScripture,ensureStudy,toast,openReference){
  const service=new InterpretationClaimService(repo);
  let study=currentStudy;
  let editing;
  const render=async()=>{
    const claims=study?await service.list(study.id):[];
    container.innerHTML=`<section class="panel claims-panel"><span class="eyebrow">INTERPRETATION CLAIMS</span><h2>What do I think this passage means?</h2><p class="panel-lede">State interpretive claims explicitly, classify how strongly the text supports them, and attach the verses you are relying on. Claims are your analysis, not generated conclusions.</p><div class="claims-list">${claims.map(claimHtml).join('')||'<p class="quiet">No interpretation claims yet.</p>'}</div><button class="primary-button" id="claimAdd" type="button">Add claim</button><div id="claimEditor"></div></section>`;
    container.querySelectorAll('[data-reference]').forEach((button)=>button.addEventListener('click',()=>openReference(button.dataset.reference)));
    container.querySelectorAll('[data-claim-action]').forEach((button)=>button.addEventListener('click',async()=>{
      const id=button.closest('[data-claim-id]')?.dataset.claimId;
      if(!id)return;
      if(button.dataset.claimAction==='delete'){
        if(!confirm('Delete this interpretation claim?'))return;
        await service.remove(id);
        if(study)await studyService.touch(study.id);
        toast('Claim deleted.');
        await render();
        return;
      }
      editing=claims.find((claim)=>claim.id===id);
      drawEditor(editing);
    }));
    container.querySelector('#claimAdd')?.addEventListener('click',()=>{editing=undefined;drawEditor();});
  };

  const drawEditor=(claim)=>{
    const editor=container.querySelector('#claimEditor');
    if(!editor)return;
    const evidence=claim?.evidence.length
      ? claim.evidence.map((item)=>({reference:formatPassage(item.passage),note:item.note??''}))
      : [{reference:formatPassage(currentScripture.passage),note:''}];
    editor.innerHTML=`<form class="claim-editor" id="claimForm"><div class="claim-editor-head"><strong>${claim?'Edit claim':'New claim'}</strong><button class="icon-button" id="claimCancel" type="button" aria-label="Close claim editor">×</button></div><label><span>Claim</span><textarea id="claimStatement" rows="4" maxlength="2000" placeholder="The author is claiming…">${esc(claim?.statement??'')}</textarea></label><label><span>Support level</span><select id="claimConfidence">${Object.entries(LABELS).map(([value,label])=>`<option value="${value}"${claim?.confidence===value?' selected':''}>${label}</option>`).join('')}</select></label><div class="claim-evidence-editor"><div class="claim-editor-subhead"><span>Textual evidence</span><button class="text-button" id="claimEvidenceAdd" type="button">+ Add reference</button></div><div id="claimEvidenceRows">${evidence.map(evidenceRow).join('')}</div></div><div class="claim-editor-actions"><button class="text-button" id="claimCancelBottom" type="button">Cancel</button><button class="primary-button" type="submit">Save claim</button></div></form>`;
    const wireRows=()=>editor.querySelectorAll('[data-claim-evidence-remove]').forEach((button)=>button.addEventListener('click',()=>button.closest('.claim-evidence-row')?.remove()));
    wireRows();
    editor.querySelector('#claimEvidenceAdd')?.addEventListener('click',()=>{
      editor.querySelector('#claimEvidenceRows')?.insertAdjacentHTML('beforeend',evidenceRow());
      wireRows();
    });
    const close=()=>{editing=undefined;editor.innerHTML='';};
    editor.querySelector('#claimCancel')?.addEventListener('click',close);
    editor.querySelector('#claimCancelBottom')?.addEventListener('click',close);
    editor.querySelector('#claimForm')?.addEventListener('submit',async(event)=>{
      event.preventDefault();
      try{
        study=study??await ensureStudy();
        const rows=[...editor.querySelectorAll('.claim-evidence-row')];
        const evidence=[];
        for(const row of rows){
          const raw=row.querySelector('[data-claim-evidence-ref]').value.trim();
          if(!raw)continue;
          const parsed=parseReference(raw);
          if(parsed.kind!=='passage')throw new Error('Evidence must be a Bible passage, for example Philippians 2:6–8.');
          const note=row.querySelector('[data-claim-evidence-note]').value.trim();
          evidence.push({passage:parsed.passage,...(note?{note}: {})});
        }
        const input={statement:editor.querySelector('#claimStatement').value,confidence:editor.querySelector('#claimConfidence').value,evidence};
        if(claim)await service.update(claim.id,input); else await service.create(study.id,input);
        study=await studyService.touch(study.id);
        toast('Interpretation claim saved.');
        editing=undefined;
        await render();
      }catch(error){toast(error instanceof Error?error.message:'Unable to save interpretation claim');}
    });
    requestAnimationFrame(()=>editor.querySelector('#claimStatement')?.focus());
  };

  await render();
}
