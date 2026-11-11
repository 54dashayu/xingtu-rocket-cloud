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
  clock=Date.now, ttl=1800000, nearTtl=600000,fetchTimeoutMs=70000}) {
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
  async function cycle(force) {
    await init();if(readOnly)return;
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
      else if(['history','upcoming'].some(key=>due(key,false)))void refresh().catch(error=>console.error('[launch-feed]',error.message));
    }
    const f=state?.feeds[range]||{};
    const stale=readFailed||!f.fetchedAt||Boolean(f.partial)||clock()-ms(f.fetchedAt)>= (state?effectiveTtl(range):ttl);
    const launches=(state?.entries||[]).filter(x=>x.range===range).map(x=>({...x.launch,dataRange:range,
      ...(range==='upcoming' && x.launch.result?.code==='pending' && ms(x.launch.timing?.net) && ms(x.launch.timing.net)<clock()
        ? {dataPending:true} : {})}));
    launches.sort((a,b)=>(ms(a.timing?.net)||Infinity)-(ms(b.timing?.net)||Infinity));
    return {launches,fetchedAt:f.fetchedAt||null,source:f.source,revision:state?.revision||0,
      snapshotAt:state?.updatedAt||null,latestAt:f.latestAt||f.fetchedAt||null,stale,
      refreshing:Boolean(running),retryAt:f.retryAt?iso(f.retryAt):null,
      warning:stale?(f.warning||'发射数据待更新，自动重试中'):null};
  }
  return {get,refresh};
}
