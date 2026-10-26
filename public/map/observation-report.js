// Independent reports: preserve users' approximate descriptions; never assert a task identity.
export function mountObservationReport(container,{onSubmitted=()=>{},onReplay=()=>{}}={}) {
 container.innerHTML=`<div class="report-heading"><h1>报告 / 档案</h1><span class="report-future">观测档案</span></div><p class="report-intro">看到天空中的火箭云？记下大概的时间、地点，我们来寻找可能对应的发射。无需知道任务名称。</p>
 <form id="observation-form"><div class="report-grid report-basics"><div><label for="report-time">时间 · 北京时间</label><input id="report-time" name="timeText" required maxlength="160" placeholder="如：10月23日傍晚"><button type="button" id="report-now">当前时间</button></div><div><label for="report-place">地点</label><input id="report-place" name="place" required maxlength="160" placeholder="如：山东烟台海边"><button type="button" id="report-locate">当前地点</button></div></div>
 <p id="report-location-state" class="report-hint" role="status">地点可模糊填写，也可填写“纬度, 经度”。当前地点是设备现在的位置，请确认与当时观测地点一致。</p>
 <label>补充说明（选填）<textarea name="notes" maxlength="1500" rows="2" placeholder="还有什么想告诉我们？"></textarea></label>
 <label class="report-check"><input name="consent" type="checkbox" required>同意将时间、地点和说明交给作者核对。</label><p class="report-privacy">报告仅作者可见，最多保存一年；定位需授权，提交前可修改。当前不上传图片，图片展馆后续开放。</p>
 <p id="report-message" role="status" aria-live="polite"></p><div class="report-footer"><button type="submit" class="report-submit">提交报告并匹配任务</button></div></form><section class="report-result" aria-live="polite" hidden></section>`;
 const form=container.querySelector('form'),message=container.querySelector('#report-message'),place=form.elements.place,time=form.elements.timeText,locate=container.querySelector('#report-locate'),locationState=container.querySelector('#report-location-state');
 let rid=crypto.randomUUID(),busy=false,geo=null,geoSerial=0;
 container.querySelector('#report-now').onclick=()=>{time.value=new Date(Date.now()+8*3600000).toISOString().slice(0,19).replace('T',' ');};
 place.addEventListener('input',()=>{geo=null;geoSerial++;locate.disabled=false;locationState.textContent='按你填写的地点提交；文字地点允许模糊。';});
 locate.onclick=()=>{
  if(!navigator.geolocation){locationState.textContent='浏览器不支持定位，请手动填写大致地点。';return;}
  const serial=++geoSerial;locate.disabled=true;locationState.textContent='正在获取当前位置，请在浏览器提示中允许定位…';
  navigator.geolocation.getCurrentPosition(position=>{
   if(serial!==geoSerial)return;locate.disabled=busy;
   if(busy)return;
   geo={latitude:position.coords.latitude,longitude:position.coords.longitude};
   place.value=`${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}`;
   locationState.textContent=`已获取设备坐标（约 ${Math.round(position.coords.accuracy)} 米精度）。请确认是观测地点，提交后才会发送。`;
  },error=>{if(serial!==geoSerial)return;locate.disabled=busy;locationState.textContent=error.code===1?'未获定位授权，请手动填写地点。':error.code===3?'定位超时，请重试或手动填写地点。':'暂时无法定位，请手动填写地点。';},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
 };
 form.onsubmit=async e=>{
  e.preventDefault();if(busy||!form.reportValidity())return;
  const f=new FormData(form),coords=place.value.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)$/);
  let point=geo;
  if(coords){point={latitude:Number(coords[1]),longitude:Number(coords[2])};if(Math.abs(point.latitude)>90||Math.abs(point.longitude)>180){message.textContent='坐标请按“纬度, 经度”填写，纬度范围 −90～90，经度 −180～180。';return;}}
  const payload={id:rid,timeText:f.get('timeText').trim(),place:f.get('place').trim(),notes:f.get('notes').trim(),consent:f.has('consent'),latitude:point?.latitude??null,longitude:point?.longitude??null,coordinateSystem:geo?'WGS84':'unknown'};
  busy=true;geoSerial++;form.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=true);message.textContent='正在保存并寻找候选任务…';
  try{
   const r=await fetch('/xingtu-analytics/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
   let data;try{data=await r.json();}catch{throw Error('暂时无法提交，填写内容已保留，请稍后重试。');}if(!r.ok)throw Error(data.error||'提交失败，请稍后重试。');
   message.textContent='报告已收到，谢谢！';form.hidden=true;
   const result=container.querySelector('.report-result');result.hidden=false;result.replaceChildren();
   const title=document.createElement('h2');title.textContent=data.candidates?.length?'可能对应的发射':'报告已保存';result.append(title);
   const note=document.createElement('p');note.textContent=data.matchNote;result.append(note);
   for(const candidate of data.candidates||[]){const row=document.createElement('div');row.className='report-candidate';const name=document.createElement('strong');name.textContent=candidate.name;const info=document.createElement('p');info.textContent=new Date(candidate.time).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+' 北京时间 · '+candidate.basis;const button=document.createElement('button');button.type='button';button.textContent='回溯参考演示';button.onclick=()=>onReplay(candidate.id);row.append(name,info,button);result.append(row);}
   const again=document.createElement('button');again.type='button';again.textContent='再报告一次';again.onclick=()=>{form.reset();form.hidden=false;result.hidden=true;message.textContent='';geo=null;rid=crypto.randomUUID();locationState.textContent='可以填写大致地点；定位取得的是设备当前位置。';};result.append(again);
   await onSubmitted(data);
  }catch(error){message.textContent=error.name==='TimeoutError'?'响应较慢，内容已保留；再次提交不会重复记录。':error.message;}
  finally{busy=false;form.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=false);}
 };
}
