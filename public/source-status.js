(async()=>{
 const root=document.getElementById('official-source-status');if(!root)return;
 try{
  const response=await fetch('./api/launches?days=30',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('unavailable');
  const data=(await response.json()).meta?.officialSources;
  root.replaceChildren();
  if(!data?.sources?.length){root.textContent='官方公告核对尚未返回状态';return;}
  const fmt=x=>x?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(x)):'暂无';
  for(const s of data.sources){const p=document.createElement('p');p.textContent=`${s.name}：${s.status==='ok'?'读取正常':'暂未读全，自动重试中'} · 最近检查 ${fmt(s.checkedAt)} 北京时间`;root.append(p);}
  const p=document.createElement('p');p.textContent=`最近核对：匹配 ${data.reconciliation?.matched||0} 项，补充 ${data.reconciliation?.added||0} 项；${data.reconciliation?.conflicts?.length||0} 项关联待核对。`;root.append(p);
 }catch{root.textContent='核对状态暂时无法读取，请稍后重试。';}
})();
