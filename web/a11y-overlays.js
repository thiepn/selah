const FOCUSABLE='button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

const restore=(target)=>{if(target instanceof HTMLElement&&target.isConnected)requestAnimationFrame(()=>target.focus());};

export function drawerController(drawer,{initialFocus}={}){
  let prior;
  const items=()=>[...drawer.querySelectorAll(FOCUSABLE)].filter((el)=>!el.hidden&&el.getAttribute('aria-hidden')!=='true');
  const close=(back=true)=>{if(drawer.hidden)return;drawer.hidden=true;if(back)restore(prior);};
  const open=(trigger=document.activeElement)=>{prior=trigger;drawer.hidden=false;requestAnimationFrame(()=>{const target=initialFocus?.()??items()[0]??drawer;if(target instanceof HTMLElement)target.focus();});};
  drawer.addEventListener('keydown',(event)=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
    if(event.key!=='Tab')return;
    const focusable=items();if(!focusable.length){event.preventDefault();drawer.focus();return;}
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  return {open,close};
}

export function regionController(region,{initialFocus}={}){
  let prior;
  const close=(back=true)=>{if(region.hidden)return;region.hidden=true;if(back)restore(prior);};
  const open=(trigger=document.activeElement)=>{prior=trigger;region.hidden=false;requestAnimationFrame(()=>{const target=initialFocus?.()??region;if(target instanceof HTMLElement)target.focus();});};
  return {open,close};
}

export function mobileSheetController(sheet,toggle,{media='(max-width:760px)'}={}){
  const query=matchMedia(media),body=[...sheet.children].filter((child)=>child!==toggle);
  const sync=()=>{
    const mobile=query.matches,open=mobile&&sheet.classList.contains('open');
    toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Collapse study tools':'Expand study tools');
    for(const child of body){child.inert=mobile&&!open;if(mobile&&!open)child.setAttribute('aria-hidden','true');else child.removeAttribute('aria-hidden');}
  };
  const open=()=>{if(query.matches){sheet.classList.add('open');sync();}};
  const close=(focus=false)=>{if(!query.matches)return false;const wasOpen=sheet.classList.contains('open');sheet.classList.remove('open');sync();if(wasOpen&&focus)restore(toggle);return wasOpen;};
  toggle.addEventListener('click',()=>sheet.classList.contains('open')?close():open());
  query.addEventListener?.('change',()=>{if(!query.matches)sheet.classList.remove('open');sync();});
  sync();
  return {open,close};
}
