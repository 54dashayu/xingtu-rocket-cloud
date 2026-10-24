import { installTianditu } from './tianditu.js?v=0.01.21';
import { renderHeadingConstraints, inBearingArc } from './heading-constraints.js?v=0.01.2';
import { renderDataAssessment, assessMissionList } from './data-assessment.js?v=0.01.6';
import { areaFill, groundLightTone, AREA_OPACITY, areaLegend } from './area-colors.js?v=20261024ax';
import { localDateTime, localTimeCandidates, simulationLaunch } from './manual-time.js?v=20261024aq';
import { playbackWindow, clampPlayback, TAIL_SECONDS } from './timeline.js?v=20261024ao';
import { solarShadePath } from './solar-shade.js?v=20261024ai';
import { HEIGHT_PRESETS, DEFAULT_HEIGHT } from './height-presets.js?v=20261024am';
import { headingEstimate } from './heading-estimate.js?v=20261024ad';
import { trajectoryStyle, regionEdges } from './overlay-style.js?v=20261024aj';
import { simulationProfile } from './prediction.js?v=20261024ay';
import { flightProfile } from './flight-path.js?v=20261024am';
import { cloudStatus, cloudOpportunity } from '../cloud-status.js?v=20261024ba';
import { visibilityFootprint, jellyfishReferenceHeight } from './visibility.js?v=20261024ay';
import { installMapNavigation } from './navigation.js?v=0.01.15';
import { solarPosition, altitudeAt } from './solar.js?v=20261024ad';
import { localSunContext, sunEvents, padTimezone } from './sun-events.js?v=20261024aq';
import { mapLaunch, upcoming, countdown, preciseTime, destination, project, splitLine, DISCLAIMER, cloudCandidate, siteInventory, geometryRating, isSunlit, siteMarkerRadius, pastLaunches } from './model.js?v=20261024al';
import { timePair, launchTimePair } from './time-display.js?v=20261024ad';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
const timeHTML=p=>p.sameBeijing?`<span class="single-time"><small>北京时间</small><b>${esc(p.beijing)}</b></span>`:`<span><small>当地${p.known?'':'（待补时区）'}</small><b>${esc(p.local)}</b></span><span><small>北京时间</small><b>${esc(p.beijing)}</b></span>`;
const safeLink=(url,label)=>{try{const u=new URL(url);return u.protocol==='https:'?`<a class="source" href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">↗ ${esc(label)}</a>`:'';}catch{return '';}};
let warningConstraint=null;
let manualLaunch=null,manualAssessmentTimer=null;
const activeLaunch=()=>manualLaunch&&manualLaunch.id===selected?.id?manualLaunch:selected;
let all=[],pool=[],visible=[],inventory=siteInventory([]),selected=null,requestId=0,offset=0,azimuth=90,target=DEFAULT_HEIGHT,manualDirection=false;
const mobileLayout=matchMedia('(max-width:850px)');
let scale=1,frame=0,playTimer=null,playSpeed=20,playLastTick=0,popoverTimer=null,popoverPinned=false,popoverAnchor=null,lastSitePointerAt=-Infinity;
let datasetMode=new URL(location.href).searchParams.get('range')==='history'?'history':'upcoming',requestedLaunchId=new URL(location.href).searchParams.get('launch'),areaCache=null;
const currentProfile=(l,options={})=>simulationProfile(l===selected?activeLaunch():l,{target,azimuth,historical:historyMode(),...options});
const period=()=>datasetMode==='history'?'过去 30 天':'未来 30 天';
const historyMode=()=>datasetMode==='history';
const statusLabel=l=>historyMode()?(l.result?.label||'已发射'):(l.scheduleStatus?.label||'待确认');
const cloudLabel=l=>!historyMode()&&$('cloud-only').checked&&cloudOpportunity(l)==='pending'?'时刻待定 · 保留关注':cloudStatus(l).code==='none'?'':cloudStatus(l).label;
const cloudBadge=l=>cloudLabel(l)?`<span class="cloud-badge ${cloudStatus(l).code}">☁ ${esc(cloudLabel(l))}</span>`:'';
const clockNow=()=>Date.now();
const linePath=points=>points.map((p,i)=>`${i?'L':'M'}${project(p).join(',')}`).join('');
for(let x=0;x<=360;x+=30)$('grid').append(svg('path',{d:`M${x},0V180`,stroke:'#9db6c2','stroke-width':'.2',opacity:'.6'}));
for(let y=0;y<=180;y+=30)$('grid').append(svg('path',{d:`M0,${y}H360`,stroke:'#9db6c2','stroke-width':'.2',opacity:'.6'}));
async function loadLand(){try{const r=await fetch('./map/land.json');if(!r.ok)throw Error();const data=await r.json();for(const f of data.features){const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const polygon of polys){const d=polygon.map(r=>r.map(([lon,lat],i)=>`${i?'L':'M'}${lon+180},${90-lat}`).join('')+'Z').join('');$('land').append(svg('path',{d,fill:'#b7ccde',stroke:'#8faac3','stroke-width':'.22','fill-rule':'evenodd'}));}}}catch{$('map-error').textContent='海岸线暂不可用；场址与任务图层仍可使用。';}}
function paintSky(date){
 const sun=solarPosition(date);$('shade').replaceChildren();$('terminator').replaceChildren();
 const belowHorizon=solarShadePath(sun,0),night=solarShadePath(sun,-6);
 $('shade').append(svg('path',{d:night,fill:'#28445d',opacity:'.32','data-solar-band':'night'}),svg('path',{d:belowHorizon+night,fill:'#e4bd86',opacity:'.24','fill-rule':'evenodd','data-solar-band':'twilight'}));
 for(const seg of splitLine(Array.from({length:361},(_,i)=>destination(sun,i,Math.PI*6371/2))))$('terminator').append(svg('path',{d:linePath(seg),fill:'none',stroke:'#7d94a8','stroke-width':'.38',opacity:'.8'}));
 const [x,y]=project(sun);$('sun').replaceChildren(svg('circle',{cx:x,cy:y,r:2,fill:'#ffcb78',opacity:'.2'}),svg('circle',{cx:x,cy:y,r:.85,fill:'#ffe1a3'}));
}
function closePopover(){clearTimeout(popoverTimer);$('site-popover').hidden=true;popoverPinned=false;popoverAnchor=null;}
function delayPopoverClose(){if(!popoverPinned)popoverTimer=setTimeout(closePopover,240);}
function positionPopover(anchor){
 const box=$('site-popover');
 if(matchMedia('(max-width:850px)').matches){box.style.left='';box.style.top='';return;}
 const r=anchor.getBoundingClientRect(),w=box.offsetWidth,h=box.offsetHeight;
 let left=r.right+12;if(left+w>innerWidth-12)left=r.left-w-12;
 box.style.left=`${Math.max(10,Math.min(innerWidth-w-10,left))}px`;box.style.top=`${Math.max(85,Math.min(innerHeight-h-12,r.top-18))}px`;
}
function showSitePopover(sites,anchor,pinned=false){
 if(navigation.isDragging())return;
 clearTimeout(popoverTimer);pinned=pinned||matchMedia('(hover:none)').matches;if(popoverPinned&&!pinned)return;
 popoverPinned=pinned;popoverAnchor=anchor;
 $('site-popover-body').innerHTML=sites.map(s=>`<section class="site-section"><p class="eyebrow">${esc(s.region || '公开任务场址')}</p><h3>${esc(s.name)}</h3><p class="site-description">${esc(s.description)}</p><small>${s.latitude.toFixed(2)}°, ${s.longitude.toFixed(2)}° · ${esc(s.timezone || '时区待补充')}</small><h4>${period()} · ${s.launches.length} 项已收录任务</h4>${s.launches.length?s.launches.map(l=>`<button class="popover-launch" data-launch="${esc(l.id)}"><strong>${cloudCandidate(l)?'☁ ':''}${esc(l.name)}</strong><span>${esc(statusLabel(l))} · ${esc(l.pad?.name || s.short)}</span><span class="time-pair">${timeHTML(launchTimePair(l))}</span><small>${esc(launchTimePair(l).note)}${cloudCandidate(l)?' · 可能出现火箭云':''}</small></button>`).join(''):'<p class="no-launches">当前时段未收录任务，不代表确定没有发射。</p>'}${s.source?safeLink(s.source,'场址资料来源'):''}</section>`).join('');
 for(const b of $('site-popover-body').querySelectorAll('[data-launch]'))b.onclick=()=>{const l=pool.find(l=>l.id===b.dataset.launch);$('cloud-only').checked=false;selectLaunch(l);closePopover();};
 $('site-popover').hidden=false;$('site-popover-body').scrollTop=0;positionPopover(anchor);
}
function renderSites(){
 $('sites').replaceChildren();
 // Merge visually colliding labels at global scale; separate again when zooming.
 const uiScale=Math.max(1,900/mapLayoutWidth());
 const clusters=[];for(const site of inventory.sites){const [x,y]=project(site);let c=clusters.find(c=>Math.hypot(c.x-x,c.y-y)<5*uiScale/scale);if(c)c.sites.push(site);else clusters.push({x,y,sites:[site]});}
 for(const copy of [-720,-360,0,360,720])for(const cluster of clusters){
 const {x,y,sites}=cluster,launches=sites.flatMap(s=>s.launches),clouds=launches.filter(cloudCandidate),chosen=launches.some(l=>l.id===selected?.id);
 const g=svg('g',{class:'site',tabindex:0,role:'button','aria-label':`${sites.map(s=>s.name).join('、')}，${launches.length}项任务${clouds.length?'，含可能出现火箭云的任务':''}`,'data-site-ids':sites.map(s=>s.id).join(','),'data-task-count':launches.length,transform:`translate(${x+copy},${y}) scale(${1/scale})`,'data-world-copy':copy});
 const markerLabel=sites.length>1?`${sites.length}处场址`:sites[0].short;
 const radius=siteMarkerRadius(launches.length)*1.3*uiScale;const labelWidth=(markerLabel.length+(launches.length?4:0))*4.5*uiScale+radius;
 const showLabel=launches.length>0||scale>1.3;
 g.append(svg('rect',{x:showLabel&&x>315?-labelWidth-4:-4,y:-Math.max(6,radius),width:showLabel?labelWidth+8:Math.max(8,radius*2),height:Math.max(12,radius*2),fill:'transparent',stroke:'none',class:'hit-target'}));

 if(clouds.length)g.append(svg('circle',{r:radius+1.1,fill:'#ffc779',opacity:'.16'}));
 if(chosen)g.append(svg('circle',{r:radius+1.2,class:'selected-ring'}));
 g.append(svg('circle',{r:radius,fill:clouds.length?'#c48625':launches.length?'#3c78ba':'#7e99a4'}));
 if(launches.length || scale>1.3){const label=sites.length>1?`${sites.length}处场址`:sites[0].short;g.append(svg('text',{x:x>315?-radius-1.5:radius+1.5,y:-2,style:`font-size:${4.5*uiScale}px`,'text-anchor':x>315?'end':'start'},`${label}${launches.length?' · '+launches.length:''}`));}
 g.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')showSitePopover(sites,g);});g.addEventListener('pointerleave',delayPopoverClose);
 // Pointer focus precedes click: opening here can cover the tapped marker and cancel its click.
 g.addEventListener('pointerdown',()=>{lastSitePointerAt=performance.now();});
 g.addEventListener('focus',()=>{if(performance.now()-lastSitePointerAt>500&&g.matches(':focus-visible'))showSitePopover(sites,g);});g.addEventListener('blur',delayPopoverClose);
 g.addEventListener('click',()=>showSitePopover(sites,g,true));g.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();showSitePopover(sites,g,true);}});$('sites').append(g);
 }

}
function renderCandidateTrails(){
 $('candidate-trails').replaceChildren();if(!$('trajectories').checked)return;
 for(const l of pool.filter(l=>cloudCandidate(l)&&l.coordinates&&l.id!==selected?.id)){
  const p=flightProfile(l,{target});for(const seg of splitLine(p.full)){const path=svg('path',{d:linePath(seg),fill:'none',stroke:'#b98227','stroke-width':'.45','stroke-dasharray':'1 .8',opacity:'.6'});path.append(svg('title',{},`${l.name} · 任务资料轨迹至 ${target} km`));$('candidate-trails').append(path);}
 }
}
function renderList(){
 pool=historyMode()?pastLaunches(all,Date.now(),30):upcoming(all,Date.now(),30);inventory=siteInventory(pool);
 visible=pool.filter(l=>(!$('cloud-only').checked||cloudCandidate(l)||cloudStatus(l).code==='observed'||(!historyMode()&&cloudOpportunity(l)==='pending')));
 $('cloud-filter-note').hidden=!$('cloud-only').checked;$('cloud-filter-note').textContent=historyMode()?'宽松初筛：日出或日落前后 90 分钟，并保留原晨昏候选与观测记录。':'宽松初筛：日出或日落前后 90 分钟；时刻待定任务保留关注。';
 $('total').textContent=pool.length;$('range-title').textContent=period()+'发射';
 $('range-upcoming').classList.toggle('active',!historyMode());$('range-history').classList.toggle('active',historyMode());$('range-upcoming').setAttribute('aria-pressed',String(!historyMode()));$('range-history').setAttribute('aria-pressed',String(historyMode()));
 const undated=pool.filter(l=>!l.timing?.net).length;
 $('coverage').textContent=`${pool.filter(l=>cloudStatus(l).code==='observed').length} 项观测证实 · ${pool.filter(cloudCandidate).length} 项可能出现 · ${pool.filter(l=>!historyMode()&&cloudOpportunity(l)==='pending').length} 项时刻待定 · ${inventory.unknown.length} 项坐标待补充${undated?' · '+undated+' 项日期待定':''}${visible.length!==pool.length?' · 列表筛选 '+visible.length+' 项':''}。地图保留全部任务。`;
 $('missions').innerHTML=visible.length?visible.map(l=>`<button class="mission ${l.id===selected?.id?'selected':''}" data-id="${esc(l.id)}" aria-pressed="${l.id===selected?.id}"><span class="status">● ${esc(statusLabel(l))}${cloudBadge(l)}</span><strong>${esc(l.name)}</strong><small>${esc(l.pad?.location || '场址待补充')}${l.coordinates?'':' · 坐标待补充'}</small><span class="time-pair">${timeHTML(launchTimePair(l))}</span><small class="precision">${esc(launchTimePair(l).note)}</small><small class="countdown" data-count="${esc(l.id)}">${esc(countdown(l,clockNow()))}</small></button>`).join(''):'<p class="empty">没有匹配项；地图和日历仍保留全部已收录任务。</p>';
 for(const b of $('missions').querySelectorAll('[data-id]'))b.onclick=()=>selectLaunch(pool.find(l=>l.id===b.dataset.id));
 renderSites();renderCandidateTrails();
}
function updatePlayButtons(){
 $('play-ascent').textContent=playTimer?'Ⅱ 暂停模拟':'▶ 模拟发射';
}
function stopPlayback(){clearInterval(playTimer);playTimer=null;updatePlayButtons();}
function selectLaunch(l,{focus=true,reveal=true}={}){
 clearTimeout(manualAssessmentTimer);
 stopPlayback();manualLaunch=null;selected=l||null;offset=0;manualDirection=false;warningConstraint=null;areaCache=null;$('offset').value=0;azimuth=headingEstimate(l||{}).azimuth;
 $('trajectories').checked=true;if(reveal)setView('map');
 renderTaskContext();
 renderList();renderDetail();document.querySelector('.detail').scrollTop=0;
 if(focus&&l?.coordinates){const p=currentProfile(l).full;navigation.focus(p[Math.floor(p.length/2)]||l.coordinates,6);}
 draw();
}
function canSetManualTime(){return selected&&!historyMode()&&!preciseTime(selected)&&!['cancelled','postponed'].includes(selected.scheduleStatus?.code);}
function manualTimeForm(){
 if(!canSetManualTime())return '';
 const zone=padTimezone(selected.pad),known=!zone.source.includes('缺失');
 const original=Date.parse(selected.timing?.net),useDate=Number.isFinite(original)&&!/月份|季度|年份|month|quarter|year/i.test(selected.timing?.precision||'');
 const value=localDateTime(manualLaunch?.timing.net||(useDate?original:Date.now()),zone.name);
 return `<section class="manual-time-card"><h3>手动发射时间 <small>当地时间</small></h3><p class="manual-zone">${known?esc(zone.name):'发射场时区待补充'}</p><div class="manual-time-fields"><label>当地日期<input id="manual-date" type="date" value="${value.slice(0,10)}" ${known?'':'disabled'}></label><label>当地时间<input id="manual-clock" type="time" step="60" value="${manualLaunch?value.slice(11,16):''}" ${known?'':'disabled'}></label></div><div id="manual-sun" class="manual-sun"></div><label id="manual-fold-label" hidden>夏令时重复时刻<select id="manual-fold"></select></label><p id="manual-time-message" role="status"></p><div class="manual-time-actions"><button id="manual-demo" type="button" disabled>▶ 按此时间演示</button><button id="manual-clear" type="button" ${manualLaunch?'':'hidden'}>恢复待定</button></div><small>仅用于演示，不修改任务公布时间。</small></section>`;
}
function bindManualTime(){
 if(!$('manual-date'))return;
 const zone=padTimezone(selected.pad),known=!zone.source.includes('缺失');
 const update=()=>{
  const date=$('manual-date').value,time=$('manual-clock').value;
  const reference=known&&date?localTimeCandidates(date+'T12:00',zone.name)[0]:null;
  if(reference&&selected.coordinates){
   const sun=sunEvents(reference,selected.coordinates,zone.name),civil=sunEvents(reference,selected.coordinates,zone.name,-6);
   const hour=t=>t?localDateTime(t,zone.name).slice(11,16):'当日无';
   $('manual-sun').innerHTML=`<span title="太阳中心位于地平线下6°">晨光始 <b>${hour(civil.sunrise)}</b></span><span>日出 <b>${hour(sun.sunrise)}</b></span><span>日落 <b>${hour(sun.sunset)}</b></span><span title="太阳中心位于地平线下6°">暮光终 <b>${hour(civil.sunset)}</b></span>`;
  }else $('manual-sun').textContent=!known?'缺少当地时区，暂不能换算。':!selected.coordinates?'缺少发射场坐标，暂不能计算晨昏时间。':'选择日期查看当天晨昏时间。';
  const choices=known&&date&&time?localTimeCandidates(date+'T'+time,zone.name):[];
  const old=$('manual-fold').value||manualLaunch?.timing.net;
  $('manual-fold-label').hidden=choices.length<2;
  $('manual-fold').innerHTML=choices.map((utc,i)=>`<option value="${utc}">${i===0?'第一次':'第二次'} · UTC ${utc.slice(11,16)}</option>`).join('');
  if(choices.includes(old))$('manual-fold').value=old;
  $('manual-demo').disabled=!choices.length||!selected.coordinates;
  $('manual-time-message').textContent=date&&time&&!choices.length&&known?'该当地时间不存在或格式无效，请调整（可能处于夏令时跳时）。':manualLaunch?'当前为手动时间模拟；修改后自动更新模型与天气。':'';
 };
 const apply=(play=false)=>{
  update();if($('manual-demo').disabled)return;
  const scenario=mapLaunch(simulationLaunch(selected,$('manual-fold').value));
  manualLaunch={...scenario,coordinates:selected.coordinates,siteId:selected.siteId,direction:selected.direction};
  stopPlayback();offset=0;areaCache=null;$('offset').value=0;
  renderDetail();draw();if(play){
   togglePlayback({inPlace:true});
   if(matchMedia('(orientation:portrait)').matches)requestAnimationFrame(()=>{
    const chart=$('profile');if(chart&&!chart.hidden){chart.setAttribute('tabindex','-1');chart.focus({preventScroll:true});chart.scrollIntoView({block:'start',behavior:'smooth'});}
   });
  }
 };
 const edited=()=>{
  clearTimeout(manualAssessmentTimer);stopPlayback();manualLaunch=null;warningConstraint=null;offset=0;areaCache=null;update();renderRating();
  $('offset').disabled=$('reset-earliest').disabled=$('reset-time').disabled=$('play-speed').disabled=true;
  $('export-event').hidden=true;draw();
  const id=selected.id;
  if(!$('manual-demo').disabled)manualAssessmentTimer=setTimeout(()=>{if(selected?.id===id&&$('manual-clock'))apply();},600);
 };
 $('manual-date').onchange=$('manual-clock').oninput=$('manual-fold').onchange=edited;
 $('manual-demo').onclick=()=>{clearTimeout(manualAssessmentTimer);apply(true);};
 $('manual-clear').onclick=()=>{clearTimeout(manualAssessmentTimer);stopPlayback();manualLaunch=null;warningConstraint=null;offset=0;areaCache=null;$('offset').value=0;renderDetail();draw();};
 update();
}

function renderDetail(){
 $('offset').disabled=!selected||!preciseTime(activeLaunch());$('reset-earliest').disabled=$('offset').disabled;$('reset-time').disabled=$('offset').disabled;$('play-speed').disabled=$('offset').disabled;$('play-ascent').hidden=!selected||!preciseTime(activeLaunch())||!selected.coordinates;
 if(!selected){$('detail').innerHTML='<p class="eyebrow">MISSION INSIGHT</p><h2>选择任务或发射场</h2><p>悬浮场址查看资料和 30 天任务；点击任务查看详情。</p>';return;}
 const l=activeLaunch(),c=l.coordinates;
 $('detail').innerHTML=`<div class="analysis-heading"><h2>轨迹与观测分析</h2><span>${historyMode()?'发射回溯':manualLaunch?'手动时间模拟':'发射预报'}</span></div>${manualTimeForm()}${c?`<section class="ascent-card"><div class="ascent-heading"><h3>上升段模拟</h3><select id="target" aria-label="轨迹终点高度">${HEIGHT_PRESETS.map(p=>`<option value="${p.height}" ${target===p.height?'selected':''}>${p.label}</option>`).join('')}</select></div><p id="profile-provenance"></p><div class="prediction-controls" id="prediction-controls"><label id="bearing-label">航向 °<input id="prediction-bearing" type="number" min="0" max="359" step="1" value="${azimuth}"></label><div class="range-readout" title="到达所选高度时的地面投影距离；模拟估算，不是当前飞行距离"><span id="range-readout-label">终点地面距离</span><output id="prediction-range" aria-labelledby="range-readout-label" aria-live="polite">—</output></div></div><div id="heading-hint" class="heading-hint"><span id="heading-basis"></span><button id="restore-heading" type="button">恢复建议</button></div><div id="warning-heading" class="warning-heading"></div><p id="historical-heading" class="historical-heading" hidden></p><svg id="profile" viewBox="0 0 260 145" role="img" aria-label="上升段高度与地面距离曲线"></svg><p id="ascent-state"></p><small><span id="profile-limit">预测参数可调，非官方飞行轨迹。</span></small><div class="ascent-actions"><button id="focus-flight" class="focus-flight">▶ 在地图演示</button></div></section>`:'<div class="info-block"><h3>上升段模拟</h3><p>缺少发射场坐标，无法绘制轨迹。</p></div>'}<div class="cloud-card" id="recommendation"></div><div id="area-evaluation" class="area-evaluation"></div><button id="export-event">下载该任务日历</button><p id="export-state" role="status"></p>`;
 if($('target'))$('target').onchange=e=>{target=Number(e.target.value);areaCache=null;stopPlayback();offset=0;$('offset').value=0;renderCandidateTrails();renderRating();scheduleDraw();};
 if($('prediction-bearing'))$('prediction-bearing').onchange=e=>{if(historyMode())return;const n=e.target.valueAsNumber;if(!Number.isFinite(n)||!e.target.checkValidity()){e.target.value=azimuth;return;}if(warningConstraint&&!inBearingArc(n,warningConstraint)){e.target.value=azimuth;return;}azimuth=n;manualDirection=true;renderRating();areaCache=null;stopPlayback();offset=0;$('offset').value=0;scheduleDraw();};
 if($('restore-heading'))$('restore-heading').onclick=()=>{if(historyMode())return;azimuth=headingEstimate(l).azimuth;manualDirection=false;warningConstraint=null;renderRating();$('prediction-bearing').value=azimuth;areaCache=null;stopPlayback();offset=0;$('offset').value=0;scheduleDraw();};
 if($('focus-flight'))$('focus-flight').onclick=()=>{setView('map');const p=currentProfile(activeLaunch());navigation.focus(p.full[Math.floor(p.full.length/2)]||l.coordinates,6);if(!playTimer)togglePlayback();$('world').scrollIntoView({block:'nearest',behavior:'smooth'});};
 bindManualTime();renderRating();
 if($('warning-heading'))renderHeadingConstraints($('warning-heading'),{launch:l,historical:historyMode()||currentProfile(l).kind!=='predicted',onApply:constraint=>{
  warningConstraint=constraint;azimuth=Math.round(constraint.center*10)/10;manualDirection=true;
  $('prediction-bearing').step='0.1';$('prediction-bearing').value=azimuth;areaCache=null;stopPlayback();offset=0;$('offset').value=0;renderRating();scheduleDraw();
 }});
  if($('export-event'))$('export-event').hidden=historyMode()||Boolean(manualLaunch);
  if($('export-event'))$('export-event').onclick=()=>downloadCalendar(`./api/launches/${encodeURIComponent(l.id)}.ics`,'launch.ics',$('export-state'));
}
function renderRating(){
 const box=$('recommendation');if(!box||!selected)return;
 box.hidden=false;
 const scenario=Boolean(manualLaunch||manualDirection);
 renderDataAssessment(box,{launch:activeLaunch(),target,azimuth,historical:historyMode(),scenario,onResult:result=>{
  if(!scenario&&result.model.target===150){selected.cloudAssessment=result;renderList();}
 }});
}
function renderProfile(profile){
 const chart=$('profile');if(!chart)return;chart.replaceChildren();
 chart.toggleAttribute('hidden',!profile.full.length);
 $('play-ascent').hidden=!profile.full.length||!preciseTime(activeLaunch());
 const predicted=profile.kind==='predicted',suggestion=headingEstimate(selected);
 const cutoff=profile.endpointKind==='published-final-cutoff';
 $('target').disabled=cutoff;
 $('target').innerHTML=cutoff?`<option>公开关车 ${Math.round(profile.target)} km</option>`:HEIGHT_PRESETS.map(p=>`<option value="${p.height}" ${target===p.height?'selected':''}>${p.label}</option>`).join('');
 $('prediction-controls').hidden=!predicted;
 $('prediction-range').textContent=profile.full.length?`${Math.round(profile.range)} km`:'—';
 $('bearing-label').hidden=historyMode();$('prediction-bearing').disabled=historyMode();
 $('heading-hint').hidden=!predicted||historyMode();$('restore-heading').hidden=!manualDirection||historyMode();
 $('heading-basis').textContent=warningConstraint?`航警模拟约束 ${Math.round(warningConstraint.start)}°–${Math.round(warningConstraint.end)}° · ${warningConstraint.id} · 任务对应待核对`:`${suggestion.label} ${suggestion.azimuth}° · ${suggestion.basis}`;
 $('historical-heading').hidden=!historyMode();
 $('historical-heading').textContent=profile.kind!=='predicted'&&profile.full.length?'航向已固定 · 采用本次任务轨迹资料':suggestion.kind==='reported_sector'?`🔒 ${selected.direction.label} · 精确角度未公开` :suggestion.kind==='sourced_heading'?`🔒 资料航向 ${suggestion.azimuth}° · 已固定`:'航向待核实 · 不以预估替代历史实际方向';
 $('focus-flight').hidden=!profile.full.length||!preciseTime(activeLaunch());
 updatePlayButtons();
 if(!profile.full.length){$('profile-provenance').textContent='历史轨迹待核实';$('ascent-state').textContent=profile.reason;$('profile-limit').textContent='补充本次任务的方向或轨迹资料后进行回算。';return;}
 $('profile-limit').textContent=predicted?(historyMode()&&suggestion.kind==='reported_sector'?`模拟说明：航向取报道代表角度 ${azimuth}°，参考演示：高度与时序非本次实测。`:'模拟说明：推力、耗燃料、重力与阻力积分；采用参考火箭参数。'):(cutoff?'终点采用本次任务公开关车节点；关车滑行段不生成新尾迹。':'采用本次任务资料，未覆盖的高度不外推。');
 $('profile-provenance').textContent=predicted?(historyMode()?'上升轨迹参考演示':`预测上升轨迹 · ${warningConstraint?'航警模拟约束':manualDirection?'手动航向':suggestion.label} ${azimuth}°`):profile.label+(profile.reached?'':' · 仅已记录段');

 const ceiling=Math.max(150,...profile.full.map(p=>p.height)),ticks=[...new Set([0,50,100,ceiling])].sort((a,b)=>a-b);
 const xy=p=>[28+p.downrange/Math.max(1,profile.range)*220,119-p.height/(ceiling*1.1)*98];
 for(const h of ticks){const y=119-h/(ceiling*1.1)*98;chart.append(svg('path',{d:`M28,${y}H248`,stroke:h===100?'#a97d44':'#3c5360','stroke-width':'.6','stroke-dasharray':'3 3'}),svg('text',{x:2,y:y+3,fill:'#607785','font-size':8},`${h}`));}
 chart.append(svg('text',{x:3,y:11,fill:'#607785','font-size':8},'高度 km'),svg('text',{x:120,y:139,fill:'#607785','font-size':8},`地面距离 0 — ${Math.round(profile.range)} km`));
 const d=points=>points.map((p,i)=>`${i?'L':'M'}${xy(p).join(',')}`).join('');
 chart.append(svg('path',{d:d(profile.full),fill:'none',stroke:'#8b774f','stroke-width':1,'stroke-dasharray':'3 3'}),svg('path',{d:d(profile.points),fill:'none',stroke:'#b98227','stroke-width':2}));
 const last=profile.points.at(-1),[x,y]=xy(last);chart.append(svg('circle',{cx:x,cy:y,r:3,fill:'#a5792c'}));
 $('ascent-state').textContent=`${offset<0?'发射前':`T+${Math.round(offset*60)} 秒`} · 高度 ${last.height.toFixed(1)} km${profile.elapsed>=profile.duration-1e-7?(cutoff?' · 公开关车节点':predicted?' · 参考截点':' · 资料段结束'):(last.emitting===false?' · '+(predicted?'模型滑行':'关车滑行'):'')}`;
}
function mapLabel(group,point,text,color,{dx=0,dy=0,anchor='start',kind='label'}={}){
 const uiScale=Math.max(1,720/mapLayoutWidth()),[x,y]=project(point),font=5.5*uiScale,w=Array.from(text).reduce((n,c)=>n+(/[\u0000-\u007f]/.test(c)?3:5.5)*uiScale,0)+5,h=10*uiScale;
 const left=anchor==='end'?-w:0;
 const g=svg('g',{transform:`translate(${x} ${y}) scale(${1/scale})`,'data-map-label':kind,'pointer-events':'none'});
 if(dx||dy)g.append(svg('path',{d:`M0,0L${dx},${dy}`,stroke:color,'stroke-width':1.2,'vector-effect':'non-scaling-stroke'}));
 g.append(svg('rect',{x:dx+left,y:dy-h/2,width:w,height:h,rx:2,fill:'#ffffff',stroke:color,'stroke-width':1.2,'vector-effect':'non-scaling-stroke',opacity:'.97'}),svg('text',{x:dx+left+2.5,y:dy+1.7,'font-size':font,'font-weight':650,fill:color},text));group.append(g);
}
function renderRoute(profile,timed){
 const group=$('trail'),style=trajectoryStyle(profile.kind,historyMode()),full=profile.full;
 if(!full.length)return;
 for(const seg of splitLine(full)){
  const d=linePath(seg);group.append(svg('path',{d,fill:'none',stroke:'#fff','stroke-width':7,'stroke-linecap':'round','vector-effect':'non-scaling-stroke',opacity:'.9'}));
  const attrs={d,fill:'none',stroke:style.color,'stroke-width':4,'stroke-linecap':'round','vector-effect':'non-scaling-stroke','data-route-kind':profile.kind};if(style.dash)attrs['stroke-dasharray']=style.dash;group.append(svg('path',attrs));
 }
 // Direction arrow follows the projected local tangent, including doglegs.
 const i=Math.max(1,Math.floor(full.length*.67)),a=project(full[i-1]),b=project(full[i]);let dx=b[0]-a[0];if(dx>180)dx-=360;if(dx< -180)dx+=360;
 const angle=Math.atan2(b[1]-a[1],dx)*180/Math.PI;
 group.append(svg('path',{d:'M-3.5,-2.4L2,0 -3.5,2.4 -2,0Z',fill:style.color,stroke:'#fff','stroke-width':'.65',transform:`translate(${b[0]} ${b[1]}) rotate(${angle}) scale(${1/scale})`,'data-route-arrow':'direction'}));
 const start=full[0],end=full.at(-1),[ex,ey]=project(end);
 group.append(svg('circle',{cx:ex,cy:ey,r:2.1/scale,fill:style.color,stroke:'#fff','stroke-width':1.6,'vector-effect':'non-scaling-stroke'}));
 mapLabel(group,start,'起飞',style.color,{dx:-8,dy:-12,anchor:'end',kind:'start'});
 mapLabel(group,end,`${Math.round(end.height)} km · ${historyMode()&&profile.kind==='predicted'?'回算':profile.kind==='predicted'?'预测':'资料轨迹'}`,style.color,{dx:-8,dy:12,anchor:'end',kind:'endpoint'});
 if(timed&&offset>0&&offset*60<=profile.duration){for(const seg of splitLine(profile.points))group.append(svg('path',{d:linePath(seg),fill:'none',stroke:style.color,'stroke-width':5,'vector-effect':'non-scaling-stroke'}));const [x,y]=project(profile.points.at(-1));group.append(svg('circle',{cx:x,cy:y,r:2.6/scale,fill:style.color,stroke:'#fff','stroke-width':2,'vector-effect':'non-scaling-stroke','data-route-position':'current'}));}
}
function renderWatchingArea(l,timed){
 const box=$('area-evaluation'),profile=currentProfile(l),atSeconds=offset*60,plumeStartHeight=jellyfishReferenceHeight(profile);
 if(timed&&l.coordinates&&profile.full.length){
  const key=JSON.stringify([l.id,l.timing.net,target,azimuth,atSeconds]);
  if(!areaCache||areaCache.key!==key){
   const options={target,persistenceSeconds:TAIL_SECONDS,untilSeconds:profile.duration,atSeconds,profile};
   areaCache={key,...visibilityFootprint(l,{...options,minElevation:1,coreElevation:5}),jellyfish:visibilityFootprint(l,{...options,minEmissionHeight:plumeStartHeight,minElevation:5}).cells};
  }
  const {cells,coreCells,twilightCells,jellyfish}=areaCache;
  if($('sector').checked&&cells.length){
   const cellPath=values=>values.map(p=>{const [x,y]=project(p);return `M${x-.5},${y-.5}h1v1h-1Z`;}).join('');
   const outline=regionEdges(cells).map(([a,b])=>`M${a.join(',')}L${b.join(',')}`).join('');
   const displaySun=solarPosition(Date.parse(l.timing.net)+atSeconds*1000);
   const paint=(values,band,region)=>{
    for(let tone=0;tone<=8;tone++){
     const group=values.filter(p=>groundLightTone(altitudeAt(displaySun,p.latitude,p.longitude))===tone);
     if(group.length)$('sector-cells').append(svg('path',{d:cellPath(group),fill:areaFill(band,tone),'fill-opacity':AREA_OPACITY,'data-region':region,'data-tone':tone}));
    }
   };
   // Disjoint classes prevent alpha stacking from changing the legend colors.
   const jellyKeys=new Set(jellyfish.map(p=>`${p.latitude},${p.longitude}`));
   for(const band of ['low','twilight','higher']){
    const values=cells.filter(p=>p.band===band&&!jellyKeys.has(`${p.latitude},${p.longitude}`));
    paint(values,band,band==='low'?'possible':band);
   }
   $('sector-cells').append(svg('path',{d:outline,fill:'none',stroke:'#fff','stroke-width':4,'vector-effect':'non-scaling-stroke'}),svg('path',{d:outline,fill:'none',stroke:'#1568c6','stroke-width':2,'stroke-dasharray':'6 3','vector-effect':'non-scaling-stroke','data-region-boundary':'possible'}));
   if(jellyfish.length){
    const edge=regionEdges(jellyfish).map(([a,b])=>`M${a.join(',')}L${b.join(',')}`).join('');
    paint(jellyfish,'jellyfish','jellyfish');
    $('sector-cells').append(svg('path',{d:edge,fill:'none',stroke:'#103f88','stroke-width':2,'stroke-dasharray':'3 3','vector-effect':'non-scaling-stroke','data-region-boundary':'jellyfish'}));
    const north=Math.max(...jellyfish.map(p=>p.latitude)),top=jellyfish.filter(p=>p.latitude===north);
    mapLabel($('sector-cells'),top[Math.floor(top.length/2)],'水母云关注区','#103f88',{dx:0,dy:-14,kind:'jellyfish'});
   }
   const minLat=cells.reduce((v,p)=>Math.min(v,p.latitude),90),south=cells.filter(p=>p.latitude===minLat),point=south[Math.floor(south.length/2)];
   mapLabel($('sector-cells'),point,historyMode()?'可能观看区':'预测可能观看区','#1261b5',{dx:0,dy:12,kind:'region'});
  }
  const scope=`当前时刻 · T${atSeconds<0?'−':'+'}${Math.abs(Math.round(atSeconds))} 秒`;
  const caption=document.querySelector('.area-caption');if(caption)caption.textContent=cells.length?'当前有观看区':'当前暂无观看区';
  box.innerHTML=`<h3>${historyMode()?'可能观看区':'预测可能观看区'}</h3><p class="visibility-scope">${scope}</p>${areaLegend()}<small>从起飞起逐时计算受光尾迹的地面可视范围，包含较低高度的尾迹。普通蓝色区域要求当地太阳低于 −6°，中／浅蓝仅要求低于 −1°；颜色表示几何与天空明暗条件，不是可见概率。分析至 ${Math.round(profile.target)} km，尾迹留存最多 5 分钟、无漂移；未计天气、散射亮度与扩散。高仰角不自动排除；可见尾迹不等于能辨认水母形态。</small>`;
 }else box.innerHTML='<h3>观看区域待计算</h3><p>缺少已核实的方向、轨迹或精确时刻，暂不绘制回算范围。</p>';
}

function updateTimeline(profile){
 const w=playbackWindow(profile),slider=$('offset');
 slider.min=w.start/60;slider.max=w.end/60;
 offset=clampPlayback(offset*60,w)/60;slider.value=offset;
 $('timeline-start').textContent=`T−${Math.abs(w.start)} 秒`;$('timeline-end').textContent=`T＋${Math.round(w.end)} 秒`;
 $('reset-earliest').title='回到最早：发射前1分钟';
 const place=(node,f)=>node.style.left=`calc(${f*100}% + ${8-16*f}px)`;
 place($('t0-marker'),w.zeroFraction);
 $('arrival-marker').hidden=w.arrival===null;
 if(w.arrival!==null){place($('arrival-marker'),w.arrivalFraction);$('arrival-label').textContent=profile.reached?`${profile.endpointKind==='published-final-cutoff'?'关车':profile.kind==='predicted'?'参考截点':''} ${Math.round(profile.target)} km · T+${Math.round(w.arrival)}秒`:`资料终点 · T+${Math.round(w.arrival)}秒`;}
 slider.setAttribute('aria-valuetext',`T${offset<0?'−':'+'}${Math.round(Math.abs(offset*60))} 秒`);
}

function scheduleDraw(){cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);}
function renderTaskContext(){
 const l=activeLaunch();
 $('mobile-task-name').textContent=l?.name||'请先选择发射任务';
 const label=l?(manualLaunch?'模拟发射':!preciseTime(l)?'发射时刻待定':historyMode()?'实际发射':'计划发射'):'发射时间待定';
 const content=`<span class="task-time-label">${label}</span>${l?timeHTML(launchTimePair(l)):''}`;
 if($('mobile-task-time').innerHTML!==content)$('mobile-task-time').innerHTML=content;
}
function draw(){
 renderTaskContext();
 const activeProfile=selected?.coordinates&&preciseTime(activeLaunch())?currentProfile(selected):null;updateTimeline(activeProfile);
 const timed=selected&&preciseTime(activeLaunch()),base=timed?Date.parse(activeLaunch().timing.net):clockNow(),date=base+offset*60000;
 if(!selected||timed)paintSky(date);else{$('shade').replaceChildren();$('terminator').replaceChildren();$('sun').replaceChildren();}
 $('world').dataset.solarTime=selected&&!timed?'':new Date(date).toISOString();
 $('offset-label').textContent=selected&&preciseTime(activeLaunch())?offset===0?(historyMode()?'实际发射时刻 T0':manualLaunch?'手动模拟时刻 T0':'发射计划时刻 T0'):`T${offset<0?'−':'+'}${Math.round(Math.abs(offset)*60)} 秒`:selected?'发射时刻待定':'当前时刻';
 $('simulation-time').innerHTML=timeHTML(selected&&!timed?launchTimePair(selected):timePair(date,selected?.pad));
 $('trail').replaceChildren();$('sector-cells').replaceChildren();$('observations').replaceChildren();$('trajectory-caption').hidden=!selected;if(!selected)return;
 const l=activeLaunch(),c=l.coordinates;
 if(c){
  const profile=currentProfile(l,{elapsed:Math.max(0,offset*60)});renderProfile(profile);
  const style=trajectoryStyle(profile.kind,historyMode()),observed=Boolean(l.cloudEvidence?.observation);
  $('trajectory-caption').innerHTML=`<div class="caption-status"><b class="mode-pill ${historyMode()?'history':'future'}">${historyMode()?'回溯':manualLaunch?'试算':'预测'}</b><span class="area-caption">观看区待计算</span></div>`;
  if(!profile.full.length){document.querySelector('.area-caption').textContent='观看区待计算';}
  $('route-legend').textContent=profile.full.length?style.label:'轨迹待核实';$('route-legend').previousElementSibling.style.borderColor=style.color;
  $('area-legend').textContent=(historyMode()?'可能观看区':'预测可能观看区');
  if($('trajectories').checked)renderRoute(profile,timed);
  renderWatchingArea(l,timed);
  $('simulation-note').textContent=profile.full.length?`${style.label} · ${profile.kind==='predicted'?'参考时长':'资料时长'} ${Math.round(profile.duration)} 秒 · 播放 ${playSpeed}×${profile.kind!=='predicted'&&!profile.reached?' · 仅已记录段':''}`:'晨昏线按任务时刻显示；轨迹与观看区等待该次任务数据。';
 }else{$('simulation-note').textContent='缺少场址坐标，无法绘制任务轨迹。';$('trajectory-caption').textContent='观看区待计算';}

}
function advancePlayback(now=performance.now()){
 if(!playTimer)return;
 const w=playbackWindow(currentProfile(selected));
 offset=clampPlayback(offset*60+(now-playLastTick)/1000*playSpeed,w)/60;playLastTick=now;
 $('offset').value=offset;scheduleDraw();if(offset*60>=w.end-1e-7)stopPlayback();
}
function togglePlayback({inPlace=false}={}){
 if(playTimer){advancePlayback();stopPlayback();return;}
 if(!selected||!preciseTime(activeLaunch())||!selected.coordinates)return;
 if(!inPlace)setView('map');const profile=currentProfile(selected);if(!profile.full.length)return;const w=playbackWindow(profile);updateTimeline(profile);
 // Resume from the selected preparation or ascent time; stop at the profile endpoint.
 if(offset*60>=w.end-1e-7)offset=0;
 offset=Math.max(Number($('offset').min),offset);$('offset').value=offset;
 playLastTick=performance.now();
 playTimer=setInterval(advancePlayback,160);updatePlayButtons();scheduleDraw();
}
function seekTime(minutes){stopPlayback();offset=clampPlayback(minutes*60,playbackWindow(selected?.coordinates&&preciseTime(activeLaunch())?currentProfile(selected):null))/60;$('offset').value=offset;scheduleDraw();}

let mobilePage='map';
const mobileScroll={map:0,calendar:0,analysis:0};
function setMobilePage(page,{scroll=true}={}){
 if(!['map','calendar','analysis'].includes(page))return;
 if(mobileLayout.matches)mobileScroll[mobilePage]=window.scrollY;
 const changed=page!==mobilePage;mobilePage=page;document.body.dataset.mobilePage=page;
 for(const b of document.querySelectorAll('[data-mobile-view]')){if(b.dataset.mobileView===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
 closePopover();if(page!=='map')stopPlayback();
 requestAnimationFrame(()=>{if(page==='map'){renderSites();scheduleDraw();}if(changed&&scroll&&mobileLayout.matches)window.scrollTo({top:mobileScroll[page],behavior:'instant'});});
}
function setView(){setMobilePage('map');}
function updateMobileLayout(){
 $('world').setAttribute('preserveAspectRatio',mobileLayout.matches?'xMidYMid slice':'xMidYMid meet');
 document.documentElement.style.setProperty('--mobile-top-height',`${document.querySelector('.header-shell').offsetHeight+document.querySelector('.mobile-task-context').offsetHeight}px`);
 renderSites();scheduleDraw();
}
function mapLayoutWidth(){const w=$('world');return Math.max(1,w.clientWidth||innerWidth,mobileLayout.matches?w.clientHeight*2:0);}
async function load(){
 const id=++requestId;stopPlayback();closePopover();$('data-state').textContent='正在读取'+period()+'任务…';$('refresh').disabled=true;
 try{const r=await fetch(historyMode()?'./api/launches/previous?days=30':'./api/launches?days=30',{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`HTTP ${r.status}`);const data=await r.json();if(!Array.isArray(data.results))throw Error('API 格式错误');if(id!==requestId)return;all=data.results.map(mapLaunch);
 $('data-state').className=`data-state ${data.meta?.stale?'warning':''}`;$('data-state').textContent=`${data.meta?.stale?'旧缓存 · 待刷新':'服务器数据'} · 更新 ${timePair(data.meta?.fetchedAt,{timezone:'Asia/Shanghai'}).beijing} 北京时间${data.meta?.warning?' · '+data.meta.warning:''}`;
 $('map-subtitle').textContent='主要发射场常驻 · 悬浮查看本期全部任务';const previous=selected?.id;selected=null;renderList();const chosen=pool.find(l=>l.id===requestedLaunchId)||pool.find(l=>l.id===previous)||(historyMode()?pool.find(l=>cloudStatus(l).code==='observed'):null)||pool[0]||null;selectLaunch(chosen,{focus:historyMode(),reveal:false});requestedLaunchId=null;
 void assessMissionList(all,historyMode(),(launch,result)=>{if(all.includes(launch)){launch.cloudAssessment=result;renderList();}});
 }catch(e){if(id!==requestId)return;all=[];selected=null;$('data-state').className='data-state warning';$('data-state').textContent=`任务数据暂不可用（${e.message}）；主要场址仍可查看。`;renderList();renderDetail();scheduleDraw();}finally{if(id===requestId)$('refresh').disabled=false;}
}
const basemap=installTianditu({world:$('world'),viewport:$('viewport'),base:$('tdt-base'),labels:$('tdt-labels'),credit:document.querySelector('.map-credit'),error:$('map-error')});
const navigation=installMapNavigation({
 world:$('world'),viewport:$('viewport'),zoomIn:$('zoom-in'),zoomOut:$('zoom-out'),back:$('back-view'),onExitFocus:()=>{stopPlayback();offset=0;$('offset').value=0;scheduleDraw();},
 onInteract:closePopover,onChange:view=>{basemap.schedule();const changed=scale!==view.scale;scale=view.scale;if(changed){renderSites();scheduleDraw();}}
});
$('site-popover').onpointerdown=()=>{clearTimeout(popoverTimer);popoverPinned=true;};$('site-popover').onpointerenter=()=>clearTimeout(popoverTimer);$('site-popover').onpointerleave=delayPopoverClose;$('close-popover').onclick=closePopover;document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePopover();if(!$('back-view').hidden&&!$('utility').open)$('back-view').click();}});window.addEventListener('resize',()=>{renderSites();scheduleDraw();if(popoverAnchor&&!$('site-popover').hidden)positionPopover(popoverAnchor);});
$('offset').oninput=e=>seekTime(Number(e.target.value));$('reset-time').onclick=()=>seekTime(0);$('reset-earliest').onclick=()=>seekTime(Number($('offset').min));$('play-ascent').onclick=togglePlayback;
$('play-speed').onchange=e=>{const next=Number(e.target.value);if(![1,2,4,10,20].includes(next))return;advancePlayback();playSpeed=next;scheduleDraw();};
$('sector').onchange=scheduleDraw;$('trajectories').onchange=()=>{renderCandidateTrails();scheduleDraw();};$('cloud-only').onchange=renderList;$('refresh').onclick=()=>void load();
$('range-upcoming').onclick=()=>setRange('upcoming');$('range-history').onclick=()=>setRange('history');
$('home').onclick=()=>setView('map');
for(const button of document.querySelectorAll('[data-mobile-view]'))button.onclick=()=>setMobilePage(button.dataset.mobileView);
mobileLayout.addEventListener('change',updateMobileLayout);
const mobileHeaderObserver=new ResizeObserver(updateMobileLayout);mobileHeaderObserver.observe(document.querySelector('.topbar'));mobileHeaderObserver.observe(document.querySelector('.global-toolbar'));mobileHeaderObserver.observe(document.querySelector('.mobile-task-context'));
updateMobileLayout();
async function setRange(mode){if(datasetMode===mode)return;datasetMode=mode;all=[];selected=null;manualLaunch=null;areaCache=null;$('cloud-only').checked=false;renderList();renderDetail();closePopover();const url=new URL(location.href);if(mode==='history')url.searchParams.set('range','history');else url.searchParams.delete('range');url.searchParams.delete('launch');history.replaceState({},'',url);await load();}
async function downloadCalendar(url,name,state){try{const r=await fetch(url);if(!r.ok)throw Error(r.status===409?'日期未确定，不能导出':`HTTP ${r.status}`);const body=await r.text();if(!body.startsWith('BEGIN:VCALENDAR'))throw Error('日历格式错误');const u=URL.createObjectURL(new Blob([body],{type:'text/calendar'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);state.textContent='已下载日历文件；需在日历软件中导入。';}catch(e){state.textContent=`未导出：${e.message}`;}}
$('close-utility-bottom').onclick=$('close-utility').onclick=()=>$('utility').close();
$('contact-author').onclick=()=>{const open=$('author-wechat').hidden;$('author-wechat').hidden=!open;$('contact-author').setAttribute('aria-expanded',String(open));if(open)$('author-wechat').scrollIntoView({block:'nearest',behavior:'smooth'});};
$('about').onclick=()=>{$('contact-author').hidden=false;$('author-wechat').hidden=true;$('contact-author').setAttribute('aria-expanded','false');$('utility-body').innerHTML=`<h2>使用说明</h2>
<h3>1. 选一次发射</h3><p>在任务列表中选择发射，或点击地图上的发射场。可以切换“未来 30 天”和“回溯 30 天”；勾选“可能出现火箭云”可缩小列表。手机底部有“地图演示”“发射日历”“观测分析”三个入口；先在日历选任务，再切换查看地图和分析。</p>
<h3>2. 播放，看范围怎样变化</h3><p>点击“模拟发射”，拖动时间条也能查看某一时刻。双左箭头按钮回到发射前，T0 是发射时刻，2×、4×等表示播放速度。“在地图演示”会切换到地图、放大轨迹并继续播放，播放结束后可再次点击重播；地图上的“返回”回到之前的视角，没有之前的视角时返回世界地图。</p>
<h3>3. 地图颜色怎么看</h3><p>发射场圆点越大，近期任务越多。灰点是常驻场址，蓝点有近期任务，金色点有值得关注的火箭云候选。地图采用天地图底图，缩小时隐藏地名，放大后显示省名，再放大可见省会等城市；地图亮暗底色表示白天和夜晚；橙色线表示模拟上升轨迹。</p><p>蓝色覆盖区域表示当前时刻可能看到受光尾迹的地方，具体分区见“观测分析”中的色标。浅蓝边缘的尾迹更靠近地平线，容易被建筑和云层挡住；深蓝“水母云关注区”值得留意，但不代表一定出现水母形状。地图颜色不等于晴天，出发前还要看“观看建议”。</p>
<h3>4. 时间未定，也可以试一试</h3><p>选中时间待定的未来任务，在“观测分析”中填写发射地的当地日期和时间，参考旁边的晨昏时间，再点击“按此时间演示”，在当前页观看图表播放，竖屏会自动滚动到图表；需要查看地图时，再点“在地图演示”。填写的时间只用于这次模拟，不会改动公布的发射计划。</p>
<h3>5. 航警和其他设置</h3><p>右侧若有“航警方向参考”，展开后可选择候选用于模拟；点击“恢复建议”可撤销。它只提供可能的方向，需要核对是否对应这次任务。100 / 150 公里是演示的终点高度，不是距离你多远；通常保留默认值即可。</p>
<h3>6. 提前准备观看</h3><p>结合任务时间、所在位置和天气决定是否留意，临近发射再刷新确认是否改期。“已证实火箭云”表示有公开观测报道；没有这一标记，不等于当时没有火箭云。点击“订阅日历”可将发射安排加入日历软件。</p><p>本工具提供观看参考，实际还会受到真实航迹、云层和遮挡影响。想了解计算方法，可查看页脚 GitHub 中的技术说明。</p>`;$('utility').showModal();};
$('subscribe').onclick=()=>{$('contact-author').hidden=true;$('author-wechat').hidden=true;
 const now=Date.now(),today=new Date(now+8*3600000).toISOString().slice(0,10);let since;try{since=localStorage.getItem('xingtu:calendar:since');}catch{}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(since||'')||since>today||since<'1900-01-01'||!Number.isFinite(Date.parse(since))||new Date(since).toISOString().slice(0,10)!==since)since=new Date(now+8*3600000-30*86400000).toISOString().slice(0,10);
 try{localStorage.setItem('xingtu:calendar:since',since);}catch{}
 const url=new URL('./api/calendar/subscription.ics',location.href);url.searchParams.set('since',since);
 $('utility-body').innerHTML=`<p class="eyebrow">日历订阅</p><h2>把发射计划带进日历</h2><p>固定起点：${since}。复制地址后，在日历软件中添加网址订阅。</p><input id="feed" readonly value="${esc(url.href)}" aria-label="日历订阅地址"><div class="utility-actions"><button id="copy-feed">复制订阅地址</button><button id="download-all">下载 30 天日历</button></div><p id="feed-state" role="status">下载为一次性副本；订阅刷新由日历软件决定。</p>`;
 $('copy-feed').onclick=async()=>{try{await navigator.clipboard.writeText(url.href);$('feed-state').textContent='地址已复制；尚未在日历软件中建立订阅。';}catch{$('feed').focus();$('feed').select();$('feed-state').textContent='请选中地址手动复制。';}};
 $('download-all').onclick=()=>downloadCalendar('./api/calendar.ics?days=30','xingtu-30-days.ics',$('feed-state'));$('utility').showModal();
};
setInterval(()=>{for(const n of document.querySelectorAll('[data-count]')){const l=pool.find(l=>l.id===n.dataset.count);if(l)n.textContent=countdown(l,clockNow());}if(selected&&$('detail-countdown'))$('detail-countdown').textContent=countdown(selected,clockNow());},1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
// Legacy preview URLs now show real API tasks too. No public fixture route remains.
const canonical=new URL(location.href);if(canonical.searchParams.has('demo')){canonical.searchParams.delete('demo');history.replaceState({},'',canonical);}
void loadLand();renderSites();void load();scheduleDraw();
