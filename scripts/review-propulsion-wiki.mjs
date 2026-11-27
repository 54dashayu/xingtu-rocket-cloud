// Read-only, bounded MediaWiki lookup. Never edits the production catalog.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const WIKI_API='https://sat.huijiwiki.com/w/api.php';
export function wikiCandidate(page){
 const r=page.revisions?.[0],content=r?.slots?.main?.content;
 if(page.missing||!r||typeof content!=='string')return {title:page.title,status:'unavailable'};
 const lines=content.split('\n');
 return {title:page.title,pageId:page.pageid,revision:r.revid,revisedAt:r.timestamp,
  url:'https://sat.huijiwiki.com/wiki/'+encodeURIComponent(page.title),revisionUrl:'https://sat.huijiwiki.com/w/index.php?oldid='+r.revid,
  status:'review_only',role:'supplementary',fuelExcerpts:lines.filter(s=>/推进剂为|使用.{0,12}推进剂|燃料\s*=|fuel\s*=|propellant\s*=/i.test(s)).slice(0,24),
  officialLinks:[...new Set((content.match(/https?:\/\/[^\s<>\[\]{}|"']+/g)||[]).filter(u=>{try{return /(?:^|\.)(?:cnsa\.gov\.cn|cmse\.gov\.cn|spacechina\.com|calt\.com|spacex\.com|esa\.int|rocketlabcorp\.com)$/.test(new URL(u).hostname);}catch{return false;}}))].slice(0,30)};
}
export async function fetchWikiReview(titles,{fetcher=fetch}={}){
 if(!titles.length||titles.length>20||titles.some(t=>typeof t!=='string'||!t.trim()||t.length>200||t.includes('|')))throw Error('请提供1—20个具体条目名');
 const url=new URL(WIKI_API);url.search=new URLSearchParams({action:'query',format:'json',formatversion:'2',prop:'revisions',rvprop:'ids|timestamp|content',rvslots:'main',titles:[...new Set(titles)].join('|'),redirects:'1',maxlag:'5'});
 const r=await fetcher(url,{headers:{'User-Agent':'XingtuResearch/0.03 (+https://space.bh1jss.net/)'},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('卫星百科 HTTP '+r.status);
 const reader=r.body?.getReader();let body;
 if(reader){const chunks=[];let size=0;try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>3000000)throw Error('响应超出3MB限制');chunks.push(next.value);}}finally{await reader.cancel().catch(()=>{});}body=Buffer.concat(chunks).toString('utf8');}
 else body=await r.text();
 const data=JSON.parse(body);if(data.error||!Array.isArray(data.query?.pages))throw Error('Wiki接口暂不可用，保留已有资料');
 return {fetchedAt:new Date().toISOString(),source:'卫星百科',api:WIKI_API,policy:'官方优先；补充资料需核对具体配置；页面不显示差异提示',pages:data.query.pages.map(wikiCandidate)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const titles=process.argv.slice(2),file=new URL('../output/propulsion-20261123/wiki-review.json',import.meta.url);
 try{
  if(!titles.length||titles.length>20||titles.some(t=>!t.trim()||t.length>200||t.includes('|')))throw Error('请提供1—20个具体条目名');
  let old;try{old=JSON.parse(await readFile(file,'utf8'));}catch{}
  if(old&&Date.now()-Date.parse(old.fetchedAt)<86400000&&titles.every(t=>old.pages.some(p=>p.title===t))){console.log('复用24小时内资料：',fileURLToPath(file));}
  else {const result=await fetchWikiReview(titles);await mkdir(new URL('.',file),{recursive:true});await writeFile(file,JSON.stringify(result,null,2)+'\n');console.log(result.pages.map(p=>({title:p.title,revision:p.revision,status:p.status})));}
 }catch(e){console.error(e.message);process.exitCode=1;}
}
