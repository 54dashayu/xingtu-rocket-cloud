import {prepareReportPhoto} from './report-photo.js?v=20261105-photo';
const LOCATION_FAILURE='定位失败，请换个环境重试，或手动填写城市、经纬度。';
export function reportCoordinates(latitude,longitude,place=''){
 const lat=latitude.trim(),lon=longitude.trim();
 if(lat||lon){
  if(!lat||!lon)throw Error('请同时填写纬度和经度，或将两项都留空。');
  const point={latitude:Number(lat),longitude:Number(lon)};
  if(!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)||Math.abs(point.latitude)>90||Math.abs(point.longitude)>180)throw Error('纬度范围为 −90～90，经度范围为 −180～180。');
  return point;
 }
 const legacy=place.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)$/);
 return legacy?reportCoordinates(legacy[1],legacy[2]):null;
}
// Independent reports: preserve users' approximate descriptions; never assert a task identity.
export function mountObservationReport(container,{onSubmitted=()=>{},onReplay=()=>{}}={}) {
 container.innerHTML=`<div class="report-heading"><h1>报告 / 档案</h1><span class="report-future">观测档案</span></div><p class="report-intro">看到天空中的火箭云？记下大概的时间、地点，我们来寻找可能对应的发射。无需知道任务名称。</p>
 <form id="observation-form"><div class="report-grid report-basics"><div><label for="report-time">时间 · 北京时间</label><input id="report-time" name="timeText" required maxlength="160" placeholder="如：10月23日傍晚"><button type="button" id="report-now">当前时间</button></div><div><label for="report-place">地点</label><input id="report-place" name="place" required maxlength="160" placeholder="如：山东烟台海边"><button type="button" id="report-locate">当前地点</button></div></div>
 <div class="report-grid report-coordinates"><div><label for="report-latitude">纬度 °N（选填）</label><input id="report-latitude" name="latitude" type="number" min="-90" max="90" step="any" placeholder="如：36.06"></div><div><label for="report-longitude">经度 °E（选填）</label><input id="report-longitude" name="longitude" type="number" min="-180" max="180" step="any" placeholder="如：103.83"></div></div>
 <p id="report-location-state" class="report-hint" role="status">地点可模糊填写，经纬度可选填。当前地点是设备现在的位置，请确认与当时观测地点一致。</p>
 <label>补充说明（选填）<textarea name="notes" maxlength="1500" rows="2" placeholder="还有什么想告诉我们？"></textarea></label>
 <fieldset class="report-photo-field"><legend>观测照片（选填，最多一张）</legend><label class="report-photo-picker" for="report-photo">拍照或选择图片<input id="report-photo" type="file" accept="image/*"></label><div id="report-photo-preview" hidden><img id="report-photo-image" alt="待提交的观测照片"><button id="report-photo-remove" type="button">移除图片</button></div><p id="report-photo-state" role="status" class="report-hint">支持相机或图库；图片将压缩后随报告提交。</p></fieldset>
 <label class="report-check"><input name="publishConsent" type="checkbox">选填：我有权分享此照片，同意审核后公开照片及管理员整理的说明（不公开原始报告、署名或经纬度）。</label>
 <label class="report-check"><input name="consent" type="checkbox" required>同意将时间、地点、说明和所选照片交给作者核对。</label><p class="report-privacy">报告默认仅作者可见，最多保存一年。公开照片须单独勾选授权并经管理员审核；未授权的旧报告保持私密。</p>
 <p id="report-message" role="status" aria-live="polite"></p><div class="report-footer"><button type="submit" class="report-submit">提交报告并匹配任务</button></div></form><section class="report-result" aria-live="polite" hidden></section>`;
 const form=container.querySelector('form'),message=container.querySelector('#report-message'),place=form.elements.place,time=form.elements.timeText,lat=form.elements.latitude,lon=form.elements.longitude,locate=container.querySelector('#report-locate'),locationState=container.querySelector('#report-location-state');
 let rid=crypto.randomUUID(),busy=false,geo=null,geoSerial=0,photo=null,photoSerial=0,photoBusy=false;
 const photoInput=container.querySelector('#report-photo'),photoPreview=container.querySelector('#report-photo-preview'),photoImage=container.querySelector('#report-photo-image'),photoState=container.querySelector('#report-photo-state');
 const clearPhoto=()=>{photoSerial++;photo=null;photoBusy=false;photoInput.value='';photoPreview.hidden=true;photoImage.removeAttribute?.('src');photoState.textContent='可选一张照片；不添加也可提交报告。';};
 container.querySelector('#report-photo-remove').onclick=clearPhoto;
 photoInput.onchange=async()=>{
  const file=photoInput.files?.[0];if(!file)return;
  const serial=++photoSerial;photoBusy=true;photoState.textContent='正在处理图片…';
  try{const value=await prepareReportPhoto(file);if(serial!==photoSerial)return;photo=value;photoImage.src=value;photoPreview.hidden=false;photoState.textContent='已选择1张照片，提交报告后才会上传；可重新选择替换。';}
  catch(error){if(serial===photoSerial)photoState.textContent=error.message+(photo?' 原照片已保留。':'');}
  finally{if(serial===photoSerial){photoBusy=false;photoInput.value='';}}
 };
 container.querySelector('#report-now').onclick=()=>{time.value=new Date(Date.now()+8*3600000).toISOString().slice(0,19).replace('T',' ');};
 place.addEventListener('input',()=>{geoSerial++;locate.disabled=false;locationState.textContent='按你填写的地点提交；文字地点允许模糊。';});
 for(const input of [lat,lon])input.addEventListener('input',()=>{geo=null;geoSerial++;locate.disabled=false;if(!place.value.trim())place.value='自定义';locationState.textContent='使用手动填写的经纬度，请确认与观测地点一致。';});
 locate.onclick=()=>{
  if(!navigator.geolocation){locationState.textContent=LOCATION_FAILURE;return;}
  const serial=++geoSerial;locate.disabled=true;locationState.textContent='正在请求浏览器位置… 已授权时不会重复弹窗。';
  let finished=false;
  const finish=()=>{if(serial!==geoSerial||finished)return false;finished=true;clearTimeout(timer);locate.disabled=busy;return !busy;};
  const timer=setTimeout(()=>{if(finish())locationState.textContent=LOCATION_FAILURE;},55000);timer.unref?.();
  const success=position=>{
   if(!finish())return;
   const c=position.coords;
   if(!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude)||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180){locationState.textContent=LOCATION_FAILURE;return;}
   geo={latitude:c.latitude,longitude:c.longitude};
   place.value='自定义';lat.value=geo.latitude.toFixed(6);lon.value=geo.longitude.toFixed(6);
   locationState.textContent=`已获取设备坐标${Number.isFinite(c.accuracy)?'（约 '+Math.round(c.accuracy)+' 米精度）':''}。请确认是观测地点，提交后才会发送。`;
  };
  const failed=error=>{
   if(!finish())return;
   locationState.textContent=LOCATION_FAILURE;
  };
  function locatePosition(highAccuracy){
   try{navigator.geolocation.getCurrentPosition(success,error=>{
    if(serial!==geoSerial||finished)return;
    if(!highAccuracy&&(error.code===2||error.code===3)){locationState.textContent='普通定位未取得位置，正在尝试高精度定位（最长30秒）…';locatePosition(true);}else failed(error);
   },{enableHighAccuracy:highAccuracy,timeout:highAccuracy?30000:12000,maximumAge:highAccuracy?0:60000});}catch(error){failed({code:error.name==='SecurityError'?1:2,message:error.message});}
  }
  locatePosition(false);
 };
 form.onsubmit=async e=>{
  e.preventDefault();if(busy||!form.reportValidity())return;
  if(photoBusy){message.textContent='图片处理中，请稍候再提交。';return;}
  const f=new FormData(form);
  let point;try{point=reportCoordinates(lat.value,lon.value,place.value);}catch(error){message.textContent=error.message;return;}
  if(f.has('publishConsent')&&!photo){message.textContent='请先选择照片，或取消公开照片选项。';return;}
  const payload={publishConsent:f.has('publishConsent'),id:rid,timeText:f.get('timeText').trim(),place:f.get('place').trim(),notes:f.get('notes').trim(),consent:f.has('consent'),latitude:point?.latitude??null,longitude:point?.longitude??null,coordinateSystem:geo?'WGS84':'unknown',...(photo?{photo}: {})};
  busy=true;geoSerial++;form.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=true);message.textContent='正在保存并寻找候选任务…';
  try{
   const r=await fetch('/xingtu-analytics/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)});
   let data;try{data=await r.json();}catch{throw Error('暂时无法提交，填写内容已保留，请稍后重试。');}if(!r.ok)throw Error(data.error||'提交失败，请稍后重试。');
   message.textContent='报告已收到，谢谢！';form.hidden=true;
   const result=container.querySelector('.report-result');result.hidden=false;result.replaceChildren();
   const title=document.createElement('h2');title.textContent=data.candidates?.length?'可能对应的发射':'报告已保存';result.append(title);
   const note=document.createElement('p');note.textContent=data.matchNote;result.append(note);
   for(const candidate of data.candidates||[]){const row=document.createElement('div');row.className='report-candidate';const name=document.createElement('strong');name.textContent=candidate.name;const info=document.createElement('p');info.textContent=new Date(candidate.time).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+' 北京时间 · '+candidate.basis;const button=document.createElement('button');button.type='button';button.textContent='回溯参考演示';button.onclick=()=>onReplay(candidate.id);row.append(name,info,button);result.append(row);}
   const again=document.createElement('button');again.type='button';again.textContent='再报告一次';again.onclick=()=>{form.reset();clearPhoto();form.hidden=false;result.hidden=true;message.textContent='';geo=null;rid=crypto.randomUUID();locationState.textContent='可以填写大致地点；定位取得的是设备当前位置。';};result.append(again);
   await onSubmitted(data);
  }catch(error){message.textContent=error.name==='TimeoutError'?'响应较慢，内容已保留；再次提交不会重复记录。':error.message;}
  finally{busy=false;form.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=false);}
 };
}
