import {reconcileOfficialEntries} from './official-state.js';
import {isWarningLaunch,reconcileWarningEntries} from './warning-state.js';
import {withDeadline} from './deadline.js';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ms = value => Date.parse(value) || 0;
const iso = value => new Date(value).toISOString();
export function retryDelay(header, now, failures = 1) {
  const seconds = Number(header);
  const directed = header ? (Number.isFinite(seconds) ? seconds * 1000 : ms(header) - now) : 0;
  return Math.max(directed, Math.min(15 * 60000, 60000 * 2 ** Math.min(4, failures - 1)));
}
export async function atomicJSON(file, value) {
  const path = file instanceof URL ? fileURLToPath(file) : file;
  await mkdir(dirname(path), {recursive:true});
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value));
  await rename(temporary, path);
}
// Exactly one writer owns this snapshot. Other services reread the same atomic file.
export function createLaunchFeed({file, readOnly=false, seed, fetchRange, beforeSave=async()=>{},
  official, officialTtl=1800000, decorate=l=>l, discover, discoveryTtl=1800000, clock=Date.now, ttl=1800000, nearTtl=600000,fetchTimeoutMs=70000}) {
  let state, initializing, running, readFailed=false;
  async function disk() {
    const value = JSON.parse(await readFile(file,'utf8'));
    if(value.schemaVersion!==1 || !Array.isArray(value.entries) || !value.feeds) throw Error('Invalid shared launch snapshot');
    return value;
  }
  async function init() {
    if(readOnly) {
      try { state=await disk();readFailed=false; } catch(error) { readFailed=true; if(!state)throw error; /* Never publish an empty replacement during an IO outage. */ }
      return;
    }
    if(state)return;
    initializing ||= (async()=>{
      try {state=await disk();return;} catch(error){if(error.code!=='ENOENT')throw error;}
      const initial=await seed();
      state={schemaVersion:1,revision:0,updatedAt:null,feeds:{},entries:[],globalRetryAt:0};
      for(const range of ['upcoming','history']) {
        const value=initial[range];
        state.feeds[range]={source:value?.source,fetchedAt:value?.fetchedAt||null,failures:0,retryAt:0};
        merge(state,range,value?.launches||[],clock());
      }
      await atomicJSON(file,state);
    })().finally(()=>{initializing=null;});
    await initializing;
  }
  function merge(next,range,launches,now) {
    const rows=new Map(next.entries.map(x=>[x.launch.id,x]));
    for(const launch of launches) {
      if(!launch?.id)continue;
      const old=rows.get(launch.id);
      if(old && ms(old.launch.lastUpdated)>ms(launch.lastUpdated))continue;
      // At equal upstream timestamps the previous endpoint wins the handover.
      if(old?.range==='history' && range==='upcoming' && ms(old.launch.lastUpdated)===ms(launch.lastUpdated))continue;
      rows.set(launch.id,{range,launch});
    }
    next.entries=[...rows.values()].filter(x=>!ms(x.launch.timing?.net)||ms(x.launch.timing.net)>=now-370*86400000);
  }
  function effectiveTtl(range) {
    const now=clock();
    return state.entries.some(x=>Math.abs(ms(x.launch.timing?.net)-now)<2*3600000) ? Math.min(ttl,nearTtl) : ttl;
  }
  function due(range,force) {
    const f=state.feeds[range]||{};
    return clock()>=Math.max(f.retryAt||0,state.globalRetryAt||0) &&
      (force || f.partial || !f.fetchedAt || clock()-ms(f.fetchedAt)>=effectiveTtl(range));
  }
  function discoveryDue(){return discover && (!state.discovery?.checkedAt || clock()-ms(state.discovery.checkedAt)>=discoveryTtl);}
  function officialDue(){const interval=state.official?.sources?.some(s=>s.status==='retrying')?Math.min(officialTtl,600000):officialTtl;return official&&(!state.official?.checkedAt||clock()-ms(state.official.checkedAt)>=interval);}
  function applyOfficial(next){
    if(!next.official?.records?.length)return;
    const applied=reconcileOfficialEntries(next.entries,next.official.records,clock());
    next.entries=applied.entries.map(e=>({...e,launch:e.launch.officialVerification?decorate(e.launch):e.launch}));
    next.official.reconciliation=applied.summary;
  }
  async function cycle(force) {
    await init();if(readOnly)return;
    // Official announcements have their own cadence and remain available during LL2 cooldowns.
    if(officialDue()) {
      const next=structuredClone(state);
      try{next.official=await withDeadline(()=>official(next.official||{}),{timeoutMs:180000});}
      catch(error){next.official={...next.official,checkedAt:iso(clock()),sources:(next.official?.sources||[{id:'cmse'},{id:'casc'}]).map(s=>({...s,status:'retrying'})),warning:'官方公告读取暂缓，自动重试中'};console.warn('[official-announcements]',error.message);}
      applyOfficial(next);
      if(discover)next.entries=reconcileWarningEntries(next.entries,next.entries.filter(e=>isWarningLaunch(e.launch)).map(e=>e.launch),clock());
      next.revision++;next.updatedAt=iso(clock());await beforeSave(next.entries.map(x=>x.launch));await atomicJSON(file,next);state=next;
    }
    // Independent of LL2 cooldown: notice discovery still works during upstream outages.
    if(discoveryDue()) {
      const next=structuredClone(state);
      try {
        const data=await withDeadline(()=>discover(),{timeoutMs:25000});
        next.entries=reconcileWarningEntries(next.entries,data.launches,clock());
        next.discovery={checkedAt:iso(clock()),fetchedAt:iso(clock()),source:data.source,noticeCount:data.noticeCount,candidateCount:data.launches.length,status:'ok'};
      }catch(error){
        next.discovery={...next.discovery,checkedAt:iso(clock()),status:'retrying',warning:'航警源暂不可用，自动重试中'};
        next.entries=reconcileWarningEntries(next.entries,next.entries.filter(e=>isWarningLaunch(e.launch)).map(e=>e.launch),clock());
        console.warn('[warning-discovery]',error.message);
      }
      next.revision++;next.updatedAt=iso(clock());await atomicJSON(file,next);state=next;
    }
    // Serial requests share a global 429 cooldown instead of competing for quota.
    for(const range of ['history','upcoming'].sort((a,b)=>ms(state.feeds[a]?.checkedAt||state.feeds[a]?.fetchedAt)-ms(state.feeds[b]?.checkedAt||state.feeds[b]?.fetchedAt))) {
      if(!due(range,force))continue;
      const next=structuredClone(state), old=next.feeds[range]||{};
      let error;
      try {
        const value=await withDeadline(signal=>fetchRange(range,{signal,deepFetchedAt:old.deepFetchedAt}),{timeoutMs:fetchTimeoutMs});
        merge(next,range,value.launches,clock());
        error=value.error;
        next.feeds[range]={...old,source:value.source,checkedAt:iso(clock()),latestAt:iso(clock()),
          deepFetchedAt:value.deepFetchedAt||old.deepFetchedAt,
          fetchedAt:error?old.fetchedAt:iso(clock()),partial:Boolean(error),failures:0,retryAt:0};
        if(!error)next.globalRetryAt=0;
      }catch(e){error=e;}
      if(error) {
        const failures=(old.failures||0)+1;
        const retryAt=clock()+retryDelay(error.retryAfter,clock(),failures);
        next.feeds[range]={...(next.feeds[range]||old),checkedAt:iso(clock()),failures,retryAt,
          warning:'上游更新暂缓，自动重试中',partial:true};
        if(error.status===429)next.globalRetryAt=retryAt;
        console.warn(`[launch-feed] ${range}: ${error.message}; retry ${iso(retryAt)}`);
      }else delete next.feeds[range].warning;
      applyOfficial(next);
      if(discover)next.entries=reconcileWarningEntries(next.entries,next.entries.filter(e=>isWarningLaunch(e.launch)).map(e=>e.launch),clock());
      next.revision++;next.updatedAt=iso(clock());
      await beforeSave(next.entries.map(x=>x.launch));
      await atomicJSON(file,next);state=next;
    }
  }
  function refresh({force=false}={}) {
    if(!running)running=cycle(force).finally(()=>{running=null;});
    return running;
  }
  async function get(range,{force=false}={}) {
    await init();
    if(!readOnly) {
      if(force||!state.entries.length)await refresh({force});
      else if(officialDue()||discoveryDue()||['history','upcoming'].some(key=>due(key,false)))void refresh().catch(error=>console.error('[launch-feed]',error.message));
    }
    const f=state?.feeds[range]||{};
    const stale=readFailed||!f.fetchedAt||Boolean(f.partial)||clock()-ms(f.fetchedAt)>= (state?effectiveTtl(range):ttl);
    const launches=(state?.entries||[]).filter(x=>x.range===range && (!isWarningLaunch(x.launch)||ms(x.launch.timing.windowEnd)>clock())).map(x=>({...x.launch,dataRange:range,
      ...(isWarningLaunch(x.launch)?{name:x.launch.name.replace("疑似发射","发射")}:{}),
      ...(range==='upcoming' && x.launch.result?.code==='pending' && ms(x.launch.timing?.net) && ms(x.launch.timing.net)<clock()
        ? {dataPending:true} : {})}));
    launches.sort((a,b)=>(ms(a.timing?.net)||Infinity)-(ms(b.timing?.net)||Infinity));
    return {launches,official:state.official?{checkedAt:state.official.checkedAt,sources:state.official.sources,reconciliation:state.official.reconciliation,reviewCount:state.official.reviews?.length||0,spacemapper:state.official.spacemapper}:null,discovery:state.discovery||null,fetchedAt:f.fetchedAt||null,source:f.source,revision:state?.revision||0,
      snapshotAt:state?.updatedAt||null,latestAt:f.latestAt||f.fetchedAt||null,stale,
      refreshing:Boolean(running),retryAt:f.retryAt?iso(f.retryAt):null,
      warning:stale?(f.warning||'发射数据待更新，自动重试中'):null};
  }
  return {get,refresh};
}
