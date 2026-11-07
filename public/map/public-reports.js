export function mountPublicReports(container,{launchId=null}={}){
 let page=1,serial=0;
 container.className='observation-archive public-reports';
 container.innerHTML='<h2>观测照片档案</h2><p>照片经授权、审核后展示，版权归原权利人所有。任务关联不等于媒体证实。</p><button type="button" class="public-refresh">刷新照片</button><p class="public-state" role="status"></p><div class="public-photo-grid"></div><div class="public-pager"><button type="button" class="public-prev">上一页</button><button type="button" class="public-next">下一页</button></div>';
 const grid=container.querySelector('.public-photo-grid'),state=container.querySelector('.public-state'),prev=container.querySelector('.public-prev'),next=container.querySelector('.public-next');
 const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
 async function load(){const id=++serial;state.textContent='正在读取…';grid.replaceChildren();prev.disabled=true;next.disabled=true;
 try{const r=await fetch('/xingtu-analytics/public-reports?page='+page+(launchId?'&launch='+encodeURIComponent(launchId):''),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const data=await r.json();if(id!==serial)return;
 for(const item of data.results){
  const card=node('article',''),img=document.createElement('img');
  card.append(node('h3',item.launchName||'待关联发射任务'));
  if(item.launchTime)card.append(node('p',new Date(item.launchTime).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+' 北京时间'));
  card.append(node('p','观测地点：'+(item.publicPlace||'提交者未公开')));
  img.src='/xingtu-analytics/public-report-images/'+encodeURIComponent(item.id);img.alt='火箭云观测照片 · '+(item.credit||'未公开署名');img.loading='lazy';
  img.onerror=()=>{img.replaceWith(node('p','图片已撤下或暂不可用。'));};
  card.append(img,node('p',item.caption),node('p','署名：'+(item.credit||'未公开署名')+' · 照片版权归原权利人所有'));
  if(item.launchId){const link=node('a','火箭云3D模型');link.href='./3d/index.html?launch='+encodeURIComponent(item.launchId)+'&range=history';card.append(link);}
  grid.append(card);
 }
 state.textContent=data.results.length?'第 '+page+' 页':'暂无获授权公开的照片';prev.disabled=page<=1;next.disabled=!data.hasMore;
 }catch{if(id===serial){state.textContent='照片暂时无法读取，请稍后刷新。';prev.disabled=page<=1;}}}
 container.querySelector('.public-refresh').onclick=()=>{page=1;void load();};prev.onclick=()=>{page--;void load();};next.onclick=()=>{page++;void load();};void load();
}
