const FOCUSABLE='button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

export function drawerController(drawer,{initialFocus}={}){
  let returnFocus;
  const items=()=>[...drawer.querySelectorAll(FOCUSABLE)].filter((el)=>!el.hidden&&el.getAttribute('aria-hidden')!=='true');
  const close=(restore=true)=>{
    if(drawer.hidden)return;
    drawer.hidden=true;
    if(restore&&returnFocus instanceof HTMLElement&&returnFocus.isConnected)requestAnimationFrame(()=>returnFocus.focus());
  };
  const open=(trigger=document.activeElement)=>{
    returnFocus=trigger instanceof HTMLElement?trigger:undefined;
    drawer.hidden=false;
    requestAnimationFrame(()=>{
      const target=(typeof initialFocus==='function'?initialFocus():undefined)??items()[0]??drawer;
      if(target instanceof HTMLElement)target.focus();
    });
  };
  drawer.addEventListener('keydown',(event)=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
    if(event.key!=='Tab')return;
    const focusable=items();
    if(!focusable.length){event.preventDefault();drawer.focus();return;}
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  return {open,close};
}


export function regionController(region,{initialFocus}={}){
  let returnFocus;
  const close=(restore=true)=>{
    if(region.hidden)return;
    region.hidden=true;
    if(restore&&returnFocus instanceof HTMLElement&&returnFocus.isConnected)requestAnimationFrame(()=>returnFocus.focus());
  };
  const open=(trigger=document.activeElement)=>{
    returnFocus=trigger instanceof HTMLElement?trigger:undefined;
    region.hidden=false;
    requestAnimationFrame(()=>{
      const target=(typeof initialFocus==='function'?initialFocus():undefined)??region;
      if(target instanceof HTMLElement)target.focus();
    });
  };
  return {open,close};
}


export function mobileSheetController(sheet,toggle,{media='(max-width:760px)'}={}){
  const query=matchMedia(media);
  const sync=()=>{
    const mobile=query.matches;
    const open=mobile&&sheet.classList.contains('open');
    toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',open?'Collapse study tools':'Expand study tools');
  };
  const open=()=>{if(!query.matches)return;sheet.classList.add('open');sync();};
  const close=(focus=false)=>{if(!query.matches)return false;const wasOpen=sheet.classList.contains('open');sheet.classList.remove('open');sync();if(wasOpen&&focus)requestAnimationFrame(()=>toggle.focus());return wasOpen;};
  const toggleSheet=()=>sheet.classList.contains('open')?close():open();
  toggle.addEventListener('click',toggleSheet);
  query.addEventListener?.('change',()=>{if(!query.matches)sheet.classList.remove('open');sync();});
  sync();
  return {open,close,sync,isOpen:()=>query.matches&&sheet.classList.contains('open')};
}
