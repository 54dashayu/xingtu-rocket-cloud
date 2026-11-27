// Observe actual Android WebView requests. No API stubs or app-state mutations.
import {writeFile} from 'node:fs/promises';
const seconds=Number(process.argv[2]||75),output=process.argv[3];
if(!output||!Number.isFinite(seconds)||seconds<1)throw Error('Usage: seconds output.json');
const pages=await(await fetch(`http://127.0.0.1:${process.env.WEBVIEW_PORT||9223}/json/list`,{signal:AbortSignal.timeout(5000)})).json();
const page=pages.find(p=>p.url.startsWith('https://space.bh1jss.net/rocket-cloud/'));
if(!page)throw Error('App WebView not found');
const ws=new WebSocket(page.webSocketDebuggerUrl),requests=[];let sequence=0;const pending=new Map();
ws.onmessage=({data})=>{const d=JSON.parse(data);if(d.id&&pending.has(d.id)){const {resolve,reject}=pending.get(d.id);pending.delete(d.id);d.error?reject(Error(d.error.message)):resolve(d.result);}
 if(d.method==='Network.requestWillBeSent'){const u=new URL(d.params.request.url);if(u.origin==='https://space.bh1jss.net'&&u.pathname.includes('/api/'))requests.push({at:new Date().toISOString(),path:u.pathname,type:d.params.type});}};
await Promise.race([new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;}),new Promise((_,reject)=>setTimeout(()=>reject(Error('WebSocket connection timeout')),5000))]);
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
await send('Network.enable');const startedAt=new Date().toISOString();console.log('Network observation started',startedAt);
if(process.argv.includes('--reload'))await send('Page.reload',{ignoreCache:false});
await new Promise(r=>setTimeout(r,seconds*1000));
const result={startedAt,seconds,requests,listRequests:requests.filter(r=>/\/api\/launches(?:\/previous)?$/.test(r.path))};
await writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({seconds,listRequests:result.listRequests.length,output}));ws.close();
