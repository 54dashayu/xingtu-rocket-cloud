import {createObserverWeatherController} from './observer-weather.js';
import {installObservers,nearestObserverCity} from './observers.js?v=0.03-0016';
import {prepareMission,missionMode,missionScenario,missionEvents,beijingInput} from './missions.js';
import {flightEvents} from './events.js';
import {GlobeView} from './scene.js?v=0.03-0015';
import {createScenario,frame,footprint,pair,observationWindow} from './geometry.js?v=0.03-0015';
import {MAJOR_SITES} from '../map/sites.js';
const $=id=>document.getElementById(id),fmt=ms=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(ms));
const sites=[{id:'comparison-jiuquan',short:'酒泉（参考场址）',latitude:40.96,longitude:100.29,timezone:'Asia/Shanghai'},...MAJOR_SITES];for(const p of sites){const o=document.createElement('option');o.value=p.id;o.textContent=p.short;$('site').append(o);}
const weatherController=createObserverWeatherController({enabled:!/Xingtu\/ios\//.test(navigator.userAgent),render:renderObserverWeather});
function renderObserverWeather(state){
 const box=$('observerWeather');box.hidden=['idle','disabled'].includes(state.state);if(box.hidden)return;
 const {observer,name,time,hasWindow}=state;
 $('weatherLocation').textContent=`${name}天气：`;
 $('weatherLocation').title=`已应用观测点 ${observer.latitude.toFixed(3)}°, ${observer.longitude.toFixed(3)}°`;
 $('weatherTime').textContent=`${hasWindow?'首个候选观测时段':'发射时刻天气参考'} · 北京时间 ${fmt(time)}`;
 const p=state.result?.points?.[0],v=p?.values||{};
 $('weatherVerdict').textContent=state.state==='loading'?'查询中…':state.state==='error'?'暂未查到':({clearer:'云层较少',mixed:'可能有云层遮挡',obstructed:'云雨或低能见度影响观看',missing:'数据不完整'})[p?.code]||state.result?.label||'此地天气暂不可用';
 $('weatherValues').textContent=p?`总云量 ${v.cloud_cover??'—'}% · 降水 ${v.precipitation??'—'} mm/h · 能见度 ${v.visibility==null?'缺测':(v.visibility/1000).toFixed(1)+' km'}`:'';
 $('weatherNote').textContent=(hasWindow?'天气仅评估所选观测地，不能保证看到火箭云。':'当前未找到候选观测时段；当地天气较好也不代表可见。')+(p?.time?` ${state.result.label} · 数据时次（北京）${fmt(p.time)}。`:'');
 $('weatherRetry').disabled=state.state==='loading';
}
function refreshObserverWeather(){
 if(!scenarios.length||!windowAssessment){weatherController.clear();return;}
 const name=$('observer').selectedOptions[0]?.textContent||'所选地点';
 void weatherController.update(scenarios[0],observer(),windowAssessment,name);
}
let windowAssessment=null;
let events=[],selectedEvent=null,boundMission=null,boundInputs=null,missionRows=[],catalogueGeneration=0;
let views=[],scenarios=[],playing=false,t=180,dirty=true,areaKey='',last=0,lastUpdate=0;const site=()=>sites.find(p=>p.id===$('site').value),azimuth=()=>+$('heading').value;
const draftObserver=()=>({latitude:+$('lat').value,longitude:+$('lon').value});
let activeObserver=draftObserver();const observer=()=>activeObserver;
const pending=()=>{$('applyStatus').textContent='设定已修改，请点击下方按钮生效';};
function valid(){if(!$('net').value)throw Error('请填写发射时刻。');const p=draftObserver();if(!$('lat').value||!$('lon').value||!Number.isFinite(p.latitude)||Math.abs(p.latitude)>90||!Number.isFinite(p.longitude)||Math.abs(p.longitude)>180)throw Error('请输入有效经纬度：纬度 −90 至 90，经度 −180 至 180。');}
function setEvent(kind){const p=pair(site(),$('net').value.slice(0,10),azimuth())[kind==='sunrise'?0:1];if(!p){$('error').textContent='当日此地点没有太阳高度 −4° 的对应交点，请手动设定时间。';return;}const ms=Date.parse(p.launch.timing.net)+8*3600000;$('net').value=new Date(ms).toISOString().slice(0,19);rebuild();}
function rebuild(){try{valid();activeObserver=draftObserver();$('error').textContent='';playing=false;$('play').textContent='播放';const linked=boundMission&&matchesMission();scenarios=[linked?missionScenario(boundMission):createScenario(site(),new Date($('net').value+'+08:00').toISOString(),azimuth())];windowAssessment=observationWindow(scenarios[0],observer());setSceneVisible(true);renderContext(scenarios[0],Boolean(boundMission&&!linked));events=linked?missionEvents(scenarios[0]):flightEvents(scenarios[0].profile);renderEvents();$('time').min=scenarios[0].profile.full[0].seconds;$('time').max=Math.ceil(Math.max(...scenarios.map(s=>s.end)));t=Math.max(+$('time').min,Math.min(t,+$('time').max));$('time').value=t;areaKey='';dirty=true;$('applyStatus').textContent='发射与观测设定已生效';if($('locationStatus').textContent)$('locationStatus').textContent=$('locationStatus').textContent.replace('点击应用后生效','观测点已应用');
 update();refreshObserverWeather();}catch(e){weatherController.clear();playing=false;scenarios=[];setSceneVisible(false);$('error').textContent=e.message;$('missionBasis').textContent='暂不能绘制：'+e.message;}}
function update(){if(!scenarios.length)return;const scale=$('exaggerate').checked?2:1;let areaNeeds=areaKey!==`${t.toFixed(2)}:${scenarios[0].launch.timing.net}`;scenarios.forEach((s,i)=>{const f=frame(s,t),obs=views[i].update(s,f,t,observer(),scale,true,events,selectedEvent);if(areaNeeds){const a=footprint(s,t);views[i].setArea(a.cells);views[i].cellCount=a.cells.length;}
 $('title'+i).textContent=(s.mode?(s.mode.historical?'历史回溯':'任务预测'):'手动实验')+' · '+fmt(s.launch.timing.net)+' 发射';$('stats'+i).textContent=`${fmt(f.time)}　|　当前可观测区域 ${views[i].cellCount} 格　|　观测点太阳 ${obs.sunAltitude.toFixed(1)}°　|　${obs.eligible.length?'符合光照筛选':obs.sunwardLimited?'朝阳方向天光偏亮':'当前不符合'}${obs.best?' · 视线仰角 '+obs.best.elevation.toFixed(1)+'°'+(obs.best.blocked?'（地球遮挡）':''):''}`;
 if(i===0){const a=s.profile.full.findLast(p=>p.seconds<=t)||s.profile.full[0],b=s.profile.full.find(p=>p.seconds>=t)||a,w=a===b?0:(t-a.seconds)/(b.seconds-a.seconds);$('heightCaption').textContent=s.sourced?'资料轨迹高度':'参考火箭高度';$('observerCaption').textContent=`观测点 · 全分析窗 ${Math.floor(windowAssessment.start)}–${Math.ceil(windowAssessment.end)} s`;$('height').textContent=t>s.profile.duration?'分析段已结束':`${(a.height+(b.height-a.height)*w).toFixed(1)} km`;$('stage').textContent=`${s.sourced?'资料段':'参考段'}至 T+${s.profile.duration.toFixed(0)} s / ${s.profile.full.at(-1).height.toFixed(0)} km`;$('particles').textContent=`当前 ${f.parcels.length} 段 · 受光 ${f.parcels.filter(p=>p.sunlit).length} 段`;$('visible').textContent=windowAssessment.possible?'窗口内可能可见':'本分析窗未找到可见时段';$('reason').textContent=windowAssessment.possible?windowAssessment.windows.map(w=>`T+${Math.round(w.start)}–${Math.round(w.end)} s`).join('、')+' · 约1秒采样，朝阳方向从严筛选':'仅指当前轨迹及尾迹留存范围，不代表整场任务不可能可见';}});areaKey=`${t.toFixed(2)}:${scenarios[0].launch.timing.net}`;$('seconds').textContent=Math.round(t);$('modeLabel').textContent=scale===1?'真实比例 · 地固坐标':'教学夸张：高度 ×2 · 几何仍按真实高度';dirty=false;updateEventStates();}
function renderEvents(){const host=$('eventList');host.replaceChildren();for(const e of events){const el=document.createElement('button');el.type='button';el.className='eventItem';el.dataset.event=e.id;const title=document.createElement('strong');title.textContent=e.symbol+' '+e.name;const meta=document.createElement('small');meta.textContent=e.seconds===null?'条件不足':`${Math.round(e.seconds)}s · ${e.origin==='source'?'资料':'估计'}${e.point?'':' · 段外'}`;el.append(title,meta);el.setAttribute('aria-label',e.name+'，'+meta.textContent+'。'+e.reason);el.onclick=()=>{selectedEvent=e.id;playing=false;$('play').textContent='播放';if(e.point){t=e.seconds;$('time').value=t;setViewMode(false);}dirty=true;$('eventDetail').textContent=`${e.name} · ${e.seconds===null?'条件不足':'T+'+e.seconds.toFixed(1)+' s'}${e.point?' · '+e.point.height.toFixed(1)+' km':' · 不在当前轨迹内，不定位'}（${e.origin==='source'?'任务资料':'示意估计'}）。${e.reason}`;};host.append(el);}selectedEvent=null;$('eventDetail').textContent='“估计”采用通用教学条件；点击查看依据，段外事件不定位。';}
function setViewMode(global){if(!scenarios.length)return;views.forEach(v=>v.focus(scenarios[0].launch.coordinates,global));$('globalView').setAttribute('aria-pressed',String(global));$('launchView').setAttribute('aria-pressed',String(!global));}
function updateEventStates(){for(const e of events){const el=document.querySelector(`[data-event="${e.id}"]`);if(!el)continue;el.classList.toggle('eventReached',e.point!==null&&t>=e.seconds);el.setAttribute('aria-pressed',String(e.id===selectedEvent));}}
function matchesMission(){return boundInputs&&$('site').value===boundInputs.site&&$('net').value===boundInputs.net&&azimuth()===boundInputs.heading;}
function setSceneVisible(visible){if(!visible)weatherController.clear();for(const selector of ['#views','.transport','.flightEvents','.readouts'])document.querySelector(selector).hidden=!visible;}
function addSource(url,name){try{const u=new URL(url);if(u.protocol!=='https:')return;const a=document.createElement('a');a.href=u.href;a.textContent=name||'资料来源';a.target='_blank';a.rel='noopener noreferrer';$('missionSources').append(a);}catch{}}
function renderContext(s,custom=false){
 const l=boundMission;$('missionSources').replaceChildren();$('missionTime').textContent=l?(Number.isFinite(Date.parse(l.timing?.net))?'北京时间 '+fmt(l.timing.net):'发射时间待定'):'';
 if(!l){$('missionTitle').textContent='手动实验 · 通用参考轨迹';$('missionBasis').textContent='非具体任务 · 地影柱默认显示';$('missionMetadata').textContent='手动设置时间、场址与航向。';$('eventBasis').textContent='通用模型 · 参考事件';return;}
 const mode=missionMode(l);$('missionTitle').textContent=l.name;
 $('missionBasis').textContent=custom?'自定义假设 · 已偏离任务参数':`${mode.historical?'历史回溯':'未来预测'} · ${mode.confirmed?'火箭云已证实':mode.historical?'观测证据未核实':mode.candidate?'火箭云候选 · 非保证':'未通过火箭云初筛'} · ${s.sourced?s.profile.label:'通用参考轨迹 · '+(s.heading?.label||'航向待确认')}`;
 $('missionMetadata').textContent=`火箭：${l.rocket||'待补充'}；场址：${l.pad?.location||l.pad?.name||'待补充'}；时刻精度：${l.timing?.precision||'待定'}。${s.heading?.basis||''}${s.sourced&&!s.profile.propulsion?' 无任务推进时序，尾迹发射仅作示意。':''} 火箭云观测证据不等于实测轨迹。`;
 for(const source of l.sources||[])addSource(source.url,source.name||'任务来源');for(const source of l.cloudEvidence?.observation?.sources||[])addSource(source.url,source.name||source.title||'火箭云观测证据');if(s.profile?.source)addSource(s.profile.source.sourceUrl,'轨迹资料');
 $('eventBasis').textContent=custom?'自定义假设':'资料优先 · 缺失用示意估计';
}
function loadMission(id){const row=missionRows.find(l=>l.id===id);if(!row){$('error').textContent='未在当前日历数据中找到该任务；历史列表不代表完整档案。';return;}
 const defaultObserver=!boundMission||boundMission.id!==row.id;boundMission=row;$('parameterDetails').open=false;$('missionRestore').disabled=false;
 const coordinates=row.coordinates;if(!coordinates){renderContext({});setSceneVisible(false);scenarios=[];$('error').textContent='任务缺少发射场坐标。';return;}
 let option=$('site').querySelector('option[value="mission-site"]');if(!option){option=document.createElement('option');option.value='mission-site';$('site').append(option);}option.textContent='任务场址 · '+(row.pad.location||row.pad.name||'发射点');const old=sites.findIndex(s=>s.id==='mission-site');const newSite={...row.pad,...coordinates,id:'mission-site'};if(old<0)sites.push(newSite);else sites[old]=newSite;
 $('site').value='mission-site';
 if(defaultObserver){const city=nearestObserverCity(coordinates);$('observer').value=city?.name||'site';setObserver();$('locationStatus').textContent=city?`默认观测点：${city.name}，距发射场约 ${Math.round(city.distanceKm)} km，可更换。`:'附近城市暂未收录，先用发射场位置，可更换观测点。';}
 else if($('observer').value==='site'){$('lat').value=coordinates.latitude;$('lon').value=coordinates.longitude;}
$('net').value=Number.isFinite(Date.parse(row.timing?.net))?beijingInput(row.timing.net):'';
 let heading=90;try{heading=missionScenario(row).heading.azimuth;}catch{}$('heading').value=heading;heading=+$('heading').value;$('headingValue').textContent=heading+'°';boundInputs={site:'mission-site',net:$('net').value,heading};
 const mode=missionMode(row),url=new URL(location.href);url.searchParams.set('launch',row.id);url.searchParams.set('range',mode.historical?'history':'upcoming');history.replaceState(null,'',url);$('backCalendar').href='../map.html?launch='+encodeURIComponent(row.id)+(mode.historical?'&range=history':'');
 renderContext({});rebuild();setViewMode(false);
}
async function loadCatalogue(){
 const generation=++catalogueGeneration,params=new URL(location.href).searchParams,requested=params.get('launch');
 playing=false;scenarios=[];setSceneVisible(false);
 if(!requested){$('missionTitle').textContent='请先在发射日历选择任务';$('missionBasis').textContent='通过任务的3D入口进入即可继续演示。';$('missionListStatus').textContent='未指定任务';return;}
 $('missionListStatus').textContent='正在读取所选任务…';
 try{
  const responses=await Promise.allSettled(['upcoming','history'].map(async range=>{
   const r=await fetch((range==='history'?'../api/launches/previous?days=365':'../api/launches?days=30'),{signal:AbortSignal.timeout(28000)}),data=await r.json();
   if(!r.ok||!Array.isArray(data.results))throw Error(data.error||'任务接口不可用');return data;
  }));
  const feeds=responses.filter(r=>r.status==='fulfilled').map(r=>r.value);
  if(!feeds.length)throw Error('任务接口暂不可用，请返回日历重试。');
  let records=[];try{records=(await fetch('../map/observation-archive.json').then(r=>r.json())).records||[];}catch{}
  if(generation!==catalogueGeneration)return;
  missionRows=[...new Map(feeds.flatMap(d=>d.results).map(l=>{const row=prepareMission(l,records);return [row.id,row];})).values()];
  if(!missionRows.some(l=>l.id===requested))throw Error('当前日历未取得所选任务，请返回日历重试。');
  $('missionListStatus').textContent=feeds.some(d=>d.meta?.stale)?'任务缓存可能过期':'已读取所选任务';
  loadMission(requested);
 }catch(e){if(generation!==catalogueGeneration)return;$('missionTitle').textContent='所选任务暂未取得';$('missionTime').textContent='';$('missionListStatus').textContent=e.message;$('error').textContent=e.message;}
}
const {setObserver}=installObservers({select:$('observer'),lat:$('lat'),lon:$('lon'),gpsButton:$('locate'),status:$('locationStatus'),site,onPending:pending});
try{const land=await fetch('../map/land.json').then(r=>r.json());views=[$('canvas0')].map(el=>new GlobeView(el,land));for(const v of views)v.focus(site(),false);if(!new URL(location.href).searchParams.has('launch'))setEvent('sunset');
$('missionRestore').onclick=()=>{if(boundMission)loadMission(boundMission.id);};$('manualMode').onclick=()=>{boundMission=null;boundInputs=null;$('missionRestore').disabled=true;$('parameterDetails').open=true;const url=new URL(location.href);url.searchParams.delete('launch');url.searchParams.delete('range');history.replaceState(null,'',url);$('backCalendar').href='../map.html';rebuild();};void loadCatalogue();
$('weatherRetry').onclick=refreshObserverWeather;
$('settings').onsubmit=e=>{e.preventDefault();rebuild();};$('settings').addEventListener('input',pending);$('heading').oninput=()=>{$('headingValue').textContent=azimuth()+'°';};$('dawn').onclick=()=>setEvent('sunrise');$('dusk').onclick=()=>setEvent('sunset');$('site').onchange=()=>{if($('observer').value==='site')setObserver();pending();};
$('globalView').onclick=()=>setViewMode(true);$('launchView').onclick=()=>setViewMode(false);
$('exaggerate').onchange=()=>{dirty=true;};document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{const v=views[+b.dataset.view];if(b.dataset.action==='reset')setViewMode(false);else v.zoom(b.dataset.action==='in'?.8:1.25);});$('time').oninput=()=>{t=+$('time').value;dirty=true;};$('play').onclick=()=>{if(!scenarios.length)return;if(t>=+$('time').max)t=0;playing=!playing;$('play').textContent=playing?'暂停':'播放';};
function animate(now){const dt=last?Math.min((now-last)/1000,.1):0;last=now;if(playing){t=Math.min(+$('time').max,t+dt*+$('speed').value);$('time').value=t;dirty=true;if(t>=+$('time').max){playing=false;$('play').textContent='播放';}}if(dirty&&now-lastUpdate>90){try{update();}catch(e){$('error').textContent=e.message;}lastUpdate=now;}views[0].render();requestAnimationFrame(animate);}requestAnimationFrame(animate);
// Read-only QA state; no production integration.
window.rocketLab={getState:()=>({t,scale:$('exaggerate').checked?2:1,counts:views.map(v=>v.cellCount),end:scenarios[0]?.end,missionId:boundMission?.id,windowAssessment,errors:$('error').textContent})};
}catch(e){$('error').textContent='三维场景加载失败：'+e.message+'。请确认浏览器已启用 WebGL。';console.error(e);}
