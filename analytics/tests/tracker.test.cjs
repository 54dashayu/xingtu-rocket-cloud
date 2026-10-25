const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync(require('node:path').join(__dirname, '../static/tracker.js'), 'utf8');
test('visible duration excludes background, beacons keep same page ID', async () => {
  let now = 0, timer; const callbacks = {}, blobs = [];
  const document = { visibilityState: 'visible', referrer: '', addEventListener: (k,f) => callbacks[k] = f };
  const window = { addEventListener: (k,f) => callbacks[k] = f };
  const context = {window, document, location:{pathname:'/launch/'}, navigator:{sendBeacon:(_,b)=>{blobs.push(b);return true;}}, Blob, crypto:{randomUUID:()=> 'a'.repeat(32)}, performance:{now:()=>now}, sessionStorage:{getItem:()=>null,setItem:()=>{}}, Date, setInterval:f=>timer=f};
  vm.runInNewContext(code, context);
  now=10000; document.visibilityState='hidden'; callbacks.visibilitychange();
  now=70000; timer(); assert.equal(blobs.length,2);
  document.visibilityState='visible'; callbacks.visibilitychange();
  now=85000; timer();
  const events=await Promise.all(blobs.map(async b=>JSON.parse(await b.text())));
  assert.deepEqual(events.map(e=>e.active_ms),[0,10000,10000,25000]);
  assert.equal(new Set(events.map(e=>e.page)).size,1);
  now=90000; callbacks.pagehide();
  now=190000; callbacks.pageshow({persisted:true});
  now=200000; timer();
  const last=JSON.parse(await blobs.at(-1).text());
  assert.equal(last.active_ms,40000);
});

test('Do Not Track stops all events without changing browser settings', () => {
  let sent=0; const script={dataset:{}};
  const context={document:{currentScript:script},window:{},location:{pathname:'/launch/'},navigator:{doNotTrack:'1',sendBeacon:()=>sent++}};
  vm.runInNewContext(code,context);
  assert.equal(sent,0); assert.equal(script.dataset.analytics,'do-not-track');
});
