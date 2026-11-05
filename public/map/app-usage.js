// First-party anonymous foreground sessions. No stable device ID, coordinates or report fields.
(() => {
 const m=navigator.userAgent.match(/Xingtu\/(android|ios)\/([\d.]+)\/(\d+)/);
 if(!m||window.__xingtuAppUsage)return;window.__xingtuAppUsage=true;
 let enabled=true;try{enabled=localStorage.getItem('xingtu-usage')!=='off';}catch{}
 if(navigator.doNotTrack==='1')enabled=false;
 const uid=()=>crypto.randomUUID().replaceAll('-','');let session=uid();
 try{const old=JSON.parse(sessionStorage.getItem('xingtu-app-session')||'null');if(old&&Date.now()-old.at<1800000)session=old.id;}catch{}
 let page=uid(),start=performance.now();let active=0,last=performance.now(),nativeVisible=true;
 const foreground=()=>nativeVisible&&document.visibilityState==='visible';let wasVisible=foreground();
 const accrue=()=>{const now=performance.now();if(wasVisible&&enabled)active+=now-last;last=now;wasVisible=foreground();};
 const send=()=>{accrue();if(!enabled)return;try{sessionStorage.setItem('xingtu-app-session',JSON.stringify({id:session,at:Date.now()}));}catch{}
 const body=JSON.stringify({page,session,platform:m[1],version:m[2],build:Number(m[3]),elapsed_ms:Math.round(performance.now()-start),active_ms:Math.round(active),foreground:foreground()});
 const url='/xingtu-analytics/app-event';if(!navigator.sendBeacon?.(url,new Blob([body],{type:'text/plain'})))fetch(url,{method:'POST',body,keepalive:true}).catch(()=>{});
 };
 document.addEventListener('visibilitychange',send);window.addEventListener('pagehide',()=>{accrue();nativeVisible=false;send();});window.addEventListener('pageshow',()=>{nativeVisible=true;send();});
 document.addEventListener('xingtu-visibility',e=>{accrue();nativeVisible=e.detail===true;send();});
 const button=document.createElement('button');button.type='button';button.style.cssText='font:inherit;padding:2px 6px;min-height:0;width:auto';const label=()=>button.textContent='使用统计：'+(enabled?'开':'关');label();
 button.onclick=()=>{enabled=!enabled;try{localStorage.setItem('xingtu-usage',enabled?'on':'off');}catch{}label();if(enabled){page=uid();start=performance.now();}active=0;last=performance.now();wasVisible=foreground();if(enabled)send();};
 document.querySelector('.footer-links')?.append(button);send();setInterval(()=>{if(foreground())send();},30000);
})();
