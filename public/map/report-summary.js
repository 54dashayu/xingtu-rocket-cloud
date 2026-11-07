// Public aggregate counts only. A report permits reference replay, never measured-trajectory status.
export function withReportCount(launch,counts={}) {
 const count=Object.hasOwn(counts,launch.id)?counts[launch.id]:0;
 return {...launch,observationReportCount:Number.isSafeInteger(count)&&count>0?count:0};
}
export async function readReportSummary({fetcher=fetch,timeoutMs=5000}={}) {
 try {
  const response=await fetcher('/xingtu-analytics/report-summary',{cache:'no-store',signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)throw Error('Report summary unavailable');
  const data=await response.json();
  if(!data?.counts||typeof data.counts!=='object'||Array.isArray(data.counts))throw Error('Invalid report summary');
  const counts=Object.fromEntries(Object.entries(data.counts).filter(([,count])=>Number.isSafeInteger(count)&&count>0));
  return {counts,available:true};
 }catch{return {counts:{},available:false};}
}
