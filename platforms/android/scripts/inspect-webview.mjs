const pages=await (await fetch(`http://127.0.0.1:${process.env.WEBVIEW_PORT || 9223}/json/list`,{signal:AbortSignal.timeout(5000)})).json();
const page=pages.find(p=>p.url.startsWith('https://space.bh1jss.net/rocket-cloud/'));
if(!page)throw Error('App WebView not found');
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:process.argv[2]||`JSON.stringify({title:document.title,page:document.body.dataset.mobilePage,tabs:[...document.querySelectorAll('.mobile-nav button')].map(b=>b.textContent),missions:document.querySelectorAll('.mission').length,state:document.querySelector('#data-state')?.textContent,error:document.querySelector('#map-error')?.textContent,tiles:document.querySelector('#world')?.dataset.basemapLoaded})`,returnByValue:true,awaitPromise:true}}));
await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('CDP timeout')),15000);ws.onmessage=event=>{const d=JSON.parse(event.data);if(d.id===1){clearTimeout(t);console.log(JSON.stringify(d.result));resolve();}};});
ws.close();
