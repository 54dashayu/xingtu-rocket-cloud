import { assessCloud } from '../../../src/cloud-assessment.js';
import { assessmentScenario } from '../../../src/assessment-scenario.js';
import { surroundingPopulation } from '../../../src/population.js';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../public/',import.meta.url));
const launchCache=new Map();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
// Local preview only. No report submissions, analytics events or production writes.
http.createServer(async(req,res)=>{
 const send=(status,body,type='text/plain; charset=utf-8')=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(body);};
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(req.method!=='GET')return send(405,'Android preparation preview is read-only.');
  if(url.pathname.startsWith('/xingtu-analytics/'))return send(503,'Reports and analytics are disabled in local preparation.');
  if(url.pathname==='/api/population'){let result;try{if(!url.searchParams.has('latitude')||!url.searchParams.has('longitude'))throw Error();result=await surroundingPopulation(Number(url.searchParams.get('latitude')),Number(url.searchParams.get('longitude')));}catch{result={status:'unavailable',reason:'坐标无效'};}return send(200,JSON.stringify(result),'application/json');}
  const assessment=url.pathname.match(/^\/api\/launches\/([a-zA-Z0-9-]+)\/cloud-assessment$/);
  if(assessment){
   const historical=url.searchParams.get('range')==='history',key=historical?'history':'upcoming';
   let entry=launchCache.get(key);
   if(!entry||Date.now()-entry.at>300000){
    const response=await fetch('https://space.bh1jss.net/rocket-cloud/api/launches'+(historical?'/previous?days=365':'?days=30'),{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Launch data unavailable');entry={data:await response.json(),at:Date.now()};launchCache.set(key,entry);
   }
   const launch=entry.data.results.find(l=>l.id===assessment[1]);if(!launch)return send(404,'Launch unavailable');
   const target=Number(url.searchParams.get('target')||150);if(![100,150].includes(target))return send(400,'Invalid target');
   const scenario=assessmentScenario(launch,{time:url.searchParams.get('simulationTime'),azimuth:url.searchParams.get('azimuth'),historical});
   const result=await assessCloud(scenario.launch,{target,...scenario.options});
   return send(200,JSON.stringify(result),'application/json');
  }
  if(url.pathname.startsWith('/api/')){
   if(!/^\/api\/(?:map-config|launches(?:\/[^/]+(?:\/(?:cloud-assessment|heading-constraints))?)?|calendar\.ics|calendar\/subscription\.ics)$/.test(url.pathname))return send(404,'API not enabled in preview');
   const upstream=await fetch('https://space.bh1jss.net/rocket-cloud'+url.pathname+url.search,{signal:AbortSignal.timeout(20000),redirect:'error'});
   return send(upstream.status,Buffer.from(await upstream.arrayBuffer()),upstream.headers.get('content-type')||'application/json');
  }
  const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/map.html':url.pathname));
  if(!path.startsWith(root.endsWith(sep)?root:root+sep))return send(403,'Forbidden');
  return send(200,await readFile(path),types[extname(path)]||'application/octet-stream');
 }catch(error){return send(error.code==='ENOENT'?404:502,'Resource unavailable; retry later.');}
}).listen(4186,'127.0.0.1',()=>console.log('Android web snapshot: http://127.0.0.1:4186 (read-only proxy; no report submissions)'));
