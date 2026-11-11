// Shared snapshot reconciliation: no browser/model dependency, also used by calendar readers.
export const isWarningLaunch=l=>l?.provenance?.kind==='navigation_warning_candidate';
function distanceKm(a,b){
 const r=Math.PI/180,h=Math.sin((b.latitude-a.latitude)*r/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin((b.longitude-a.longitude)*r/2)**2;
 return 12742*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
}
export function warningMatches(candidate,launch){
 if(isWarningLaunch(launch))return false;
 const lat=Number(launch.pad?.latitude),lon=Number(launch.pad?.longitude);
 const sameSite=(launch.pad?.originalLocation||launch.pad?.location||'').includes(candidate.pad.originalLocation)||
  (launch.pad?.latitude!=null&&launch.pad?.longitude!=null&&Number.isFinite(lat)&&Number.isFinite(lon)&&distanceKm({latitude:lat,longitude:lon},{latitude:candidate.pad.latitude,longitude:candidate.pad.longitude})<80);
 const t=Date.parse(launch.timing?.net);const precise=/分钟|秒|小时|minute|second|hour/i.test(launch.timing?.precision||'');
 return sameSite&&precise&&t>=Date.parse(candidate.timing.windowStart)-30*60000&&t<=Date.parse(candidate.timing.windowEnd)+30*60000;
}
export function reconcileWarningEntries(entries,candidates,now=Date.now()){
 const regular=entries.filter(e=>!isWarningLaunch(e.launch));
 const retained=[];
 for(const c of candidates){
  if(Date.parse(c.timing.windowEnd)<=now)continue;
  const matches=regular.filter(e=>warningMatches(c,e.launch));
  if(matches.length===1){const e=matches[0];e.launch={...e.launch,warningReference:{...c.warningDiscovery,match:'时间与场址匹配参考'},sources:[...(e.launch.sources||[]),...c.sources.filter(s=>!e.launch.sources?.some(x=>x.url===s.url))]};}
  else retained.push({range:'upcoming',launch:c});
 }
 return [...regular,...retained];
}
