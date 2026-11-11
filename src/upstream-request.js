import {readFile} from 'node:fs/promises';
import {atomicJSON} from './launch-feed.js';

export {withDeadline} from './deadline.js';

// Persist reservations before sending; failures also consume upstream quota.
// One writer service shares this budget across both endpoints and every page.
export function createRequestBudget({file,limit=14,windowMs=3600000,clock=Date.now}) {
 let queue=Promise.resolve();
 return async function reserve(){
  const job=queue.then(async()=>{
   let entries=[];try{entries=JSON.parse(await readFile(file,'utf8'));if(!Array.isArray(entries)||entries.some(x=>!Number.isFinite(x)))throw Error('Invalid upstream request budget');}catch(e){if(e.code!=='ENOENT')throw e;}
   const now=clock();entries=entries.filter(t=>t>now-windowMs);
   if(entries.length>=limit)throw Object.assign(new Error('Local upstream quota reserved; retry automatically'),{status:429,retryAfter:String(Math.max(1,Math.ceil((Math.min(...entries)+windowMs-now)/1000)))});
   entries.push(now);await atomicJSON(file,entries);
  });
  queue=job.catch(()=>{});return job;
 };
}
