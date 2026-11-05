export function mountPublicReports(container){
 let page=1,serial=0;
 container.className='observation-archive public-reports';
 container.innerHTML='<h2>用户观测照片</h2><p>经提交者授权、管理员审核展示；不代表已证实对应某次发射。</p><button type="button" class="public-refresh">刷新照片</button><p class="public-state" role="status"></p><div class="public-photo-grid"></div><div class="public-pager"><button type="button" class="public-prev">上一页</button><button type="button" class="public-next">下一页</button></div>';
 const grid=container.querySelector('.public-photo-grid'),state=container.querySelector('.public-state'),prev=container.querySelector('.public-prev'),next=container.querySelector('.public-next');
 async function load(){const id=++serial;state.textContent='正在读取…';grid.replaceChildren();prev.disabled=true;next.disabled=true;
 try{const r=await fetch('/xingtu-analytics/public-reports?page='+page,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const data=await r.json();if(id!==serial)return;
 for(const item of data.results){const card=document.createElement('article'),img=document.createElement('img'),caption=document.createElement('p');img.src='/xingtu-analytics/public-report-images/'+encodeURIComponent(item.id);img.alt='已授权公开的观测照片';img.loading='lazy';img.onerror=()=>{img.remove();caption.textContent='图片已撤下或暂不可用。';};caption.textContent=item.caption;card.append(img,caption);grid.append(card);}
 state.textContent=data.results.length?'第 '+page+' 页':'暂无公开照片';prev.disabled=page<=1;next.disabled=!data.hasMore;
 }catch{if(id===serial){state.textContent='照片暂时无法读取，请稍后刷新。';prev.disabled=page<=1;}}}
 container.querySelector('.public-refresh').onclick=()=>{page=1;void load();};prev.onclick=()=>{page--;void load();};next.onclick=()=>{page++;void load();};void load();
}
