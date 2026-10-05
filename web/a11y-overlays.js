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
