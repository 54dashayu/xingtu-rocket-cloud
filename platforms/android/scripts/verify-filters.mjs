import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const expression=`(async()=>{
 const results=[];
 const ids=()=>[...document.querySelectorAll('#missions .mission')].map(e=>e.dataset.id).sort();
 const set=(id,value)=>{const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
 const filters=['history-country','history-crewed','history-ownership'];
 for(const mode of ['upcoming','history']){
  document.getElementById('range-'+mode).click();
  for(let n=0;n<100&&document.querySelector('#refresh').disabled;n++)await new Promise(r=>setTimeout(r,100));
  if(document.querySelector('#refresh').disabled)throw Error('Loading did not finish');
  document.querySelector('.mobile-nav [data-mobile-view=calendar]').click();
  for(const id of filters)set(id,'');
  const base=ids();if(!base.length)throw Error('No baseline missions');
  const r=await fetch(mode==='history'?'./api/launches/previous?days=30':'./api/launches?days=30');
  if(!r.ok)throw Error('API not available');const data=await r.json();
  const pool=data.results.filter(l=>base.includes(l.id));
  if(pool.length!==base.length)throw Error('API changed during test');
  const cases=[['country','CN'],['crewed','true'],['crewed','false'],['ownership','state'],['ownership','private'],['combined','CN']];
  for(const [kind,value]of cases){
   for(const id of filters)set(id,'');
   if(kind==='combined'){set('history-country','CN');set('history-crewed','false');set('history-ownership','state');}
   else set('history-'+kind,value);
   const expected=pool.filter(l=>kind==='country'?l.country?.code===value:kind==='crewed'?l.crewed===(value==='true'):kind==='ownership'?l.agency?.ownership===value:l.country?.code==='CN'&&l.crewed===false&&l.agency?.ownership==='state').map(l=>l.id).sort();
   const actual=ids();if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(mode+'/'+kind+' mismatch');
   results.push({mode,filter:kind,value,count:actual.length});
  }
  for(const id of filters)set(id,'');
  const hidden=document.querySelector('#history-period').hidden,evidence=document.querySelector('#evidence-filters').hidden;
  if(hidden!==(mode==='upcoming')||evidence!==(mode==='upcoming'))throw Error('Mode visibility mismatch');
  if(filters.some(id=>document.getElementById(id).getBoundingClientRect().height===0))throw Error('Filter hidden');
  if(document.documentElement.scrollWidth>innerWidth)throw Error('Horizontal overflow');
 }
 return JSON.stringify({pass:true,width:innerWidth,results});
})()`;
const out=spawnSync(process.execPath,[fileURLToPath(new URL('./inspect-webview.mjs',import.meta.url)),expression],{encoding:'utf8'});
process.stdout.write(out.stdout);process.stderr.write(out.stderr);
if(out.status)process.exit(out.status);
const data=JSON.parse(out.stdout);if(data.exceptionDetails||!data.result?.value)process.exit(1);
