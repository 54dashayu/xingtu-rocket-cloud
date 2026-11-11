// Public official HTML, not an undocumented API. Only structured launch facts are retained.
import {createHash} from 'node:crypto';
export const OFFICIAL_SOURCES=[
 {id:'cmse',name:'中国载人航天工程办公室',host:'www.cmse.gov.cn',lists:['https://www.cmse.gov.cn/xwzx/zhxw/','https://www.cmse.gov.cn/gfgg/','https://www.cmse.gov.cn/fxrw/']},
 {id:'casc',name:'中国航天科技集团',host:'www.spacechina.com',lists:['https://www.spacechina.com/n25/n2014789/n2014804/index.html','https://www.spacechina.com/n25/index.html']}
];
export const textOf=s=>String(s||'').replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|ensp|emsp);/gi,' ').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/\s+/g,' ').trim();
function element(html,attribute,value){
 const start=new RegExp(`<div\\b[^>]*${attribute}=["']?${value}(?:["'\\s>])[^>]*>`,'i').exec(html);
 if(!start)return '';
 const tail=html.slice(start.index+start[0].length);let depth=1;
 for(const m of tail.matchAll(/<\/?div\b[^>]*>/gi)){depth+=/^<\//.test(m[0])?-1:1;if(!depth)return tail.slice(0,m.index);}
 return '';
}
export function officialLinks(html,base){
 const host=new URL(base).hostname,links=new Map();
 for(const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  try{const u=new URL(m[1],base);const title=textOf(m[2]);
   if(u.protocol==='https:'&&u.hostname===host&&(/\/t\d+_\d+\.html$|\/c\d+\/content\.html$/.test(u.pathname))&&/发射|升空/.test(title)&&!/标识|征集|纪念|回顾|档案|周年|出征仪式|运抵|再入|出舱/.test(title))links.set(u.href,{url:u.href,title});
  }catch{}
 }
 return [...links.values()];
}
export function chineseNumber(s){if(/^\d+$/.test(s))return String(Number(s));const d={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};let total=0,n=0;for(const c of s){if(c==='十'){total+=(n||1)*10;n=0;}else if(c==='百'){total+=(n||1)*100;n=0;}else if(c in d)n=d[c];else return s;}return String(total+n);}
export function identity(s){return String(s||'').toLowerCase().replace(/yaogan[ -]*/g,'遥感').replace(/shenzhou[ -]*/g,'神舟').replace(/tianzhou[ -]*/g,'天舟').replace(/guowang|satnet/g,'卫星互联网低轨').replace(/[零〇一二两三四五六七八九十百]+/g,chineseNumber).replace(/\d+/g,chineseNumber).replace(/载人飞船|货运飞船|飞行任务|飞船|载人|卫星|号|星|组|批|至|to|leo|group|\s|[-—–|｜（()）]/g,'');}
const missionRE=/(?:神舟[零〇一二三四五六七八九十百\d]+号|天舟[零〇一二三四五六七八九十百\d]+号|嫦娥[一二三四五六七八九十\d]+号|遥感[一二三四五六七八九十百\d]+号(?:\s*\d+(?:\s*[-—–至]\s*\d+)?)?(?:星|卫星)?|卫星互联网(?:低轨|高轨|技术试验)(?:[一二三四五六七八九十百\d]+(?:组|批))?(?:卫星)?|千帆[\u4e00-\u9fa5\d]{0,8}(?:组|批)卫星|(?:试验|实践|风云|天链)[一二三四五六七八九十百\d]+号[\dA-Z、-]*(?:星|卫星)?)/g;
const SITES=[['海南商业航天发射场','文昌',19.597,110.931],['文昌航天发射场','文昌',19.597,110.931],['文昌航天发射中心','文昌',19.597,110.931],['酒泉卫星发射中心','酒泉',40.892,100.217],['太原卫星发射中心','太原',38.85,111.61],['西昌卫星发射中心','西昌',28.25,102.03]];
export function parseOfficialArticle(html,{url,source,now=Date.now()}){
 if(new URL(url).hostname!==source.host)throw Error('Unexpected official host');
 const cmse=source.id==='cmse';
 const body=textOf(element(html,cmse?'id':'class',cmse?'dochtmlcon':'article_text'));
 const title=textOf(cmse?(html.match(/<div class="title">([\s\S]*?)<\/div>/)?.[1]):element(html,'class','article_title'));
 const dateText=cmse?textOf(element(html,'class','pubDate')):textOf(element(html,'class','article_attr'));
 const pub=dateText.match(/(20\d{2})[年-](\d{1,2})[月-](\d{1,2})/);
 if(!body||!title||!pub)return {reason:'页面结构或发布日期无法识别'};
 const publishedAt=`${pub[1]}-${pub[2].padStart(2,'0')}-${pub[3].padStart(2,'0')}T00:00:00+08:00`;
 // The event must be in a launch sentence, never a sidebar or a publication timestamp.
 const paragraphs=body.split(/[。！？]/).filter(s=>/点火(?:升空|发射)|发射升空|发射[，,]|实施发射|发射取得|发射任务|送入预定轨道/.test(s)&&/\d{1,2}月\d{1,2}日/.test(s));
 const timed=paragraphs.filter(s=>/\d{1,2}[时:]\d{1,2}分?/.test(s));
 if(timed.length!==1)return {reason:'没有唯一、精确的发射时刻'};
 const lead=timed[0];
 if(/曾于|回顾|去年|历次|上一次/.test(lead))return {reason:'历史引用非本次发射'};
 const dt=lead.match(/(?:(20\d{2})年)?(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[时:](\d{1,2})分?(?:(\d{1,2})秒)?/);
 if(!dt)return {reason:'时间格式待人工核对'};
 let year=+(dt[1]||pub[1]);if(!dt[1]&&+pub[2]===1&&+dt[2]===12)year--;
 if(!dt[1]&&+pub[2]===12&&+dt[2]===1)year++;
 const local=`${year}-${dt[2].padStart(2,'0')}-${dt[3].padStart(2,'0')}T${dt[4].padStart(2,'0')}:${dt[5].padStart(2,'0')}:${(dt[6]||'00').padStart(2,'0')}+08:00`;
 const ts=Date.parse(local);
 if(!Number.isFinite(ts)||+dt[4]>23||+dt[5]>59||+(dt[6]||0)>59||new Date(ts+28800000).getUTCDate()!==+dt[3]||Math.abs(ts-Date.parse(publishedAt))>45*86400000)return {reason:'事件日期超出可靠关联范围'};
 const missions=[...new Set((lead.match(missionRE)||[]).map(x=>x.replace(/\s/g,'')))];
 const selected=missions.filter(x=>identity(title).includes(identity(x)));
 if(selected.length!==1)return {reason:'任务名称不唯一或与标题不一致'};
 const mission=selected[0];const site=SITES.find(s=>lead.includes(s[0]));
 if(!site)return {reason:'发射地点未明确'};
 const rocketMatch=lead.match(/长征([一二三四五六七八九十]+|\d+)号([甲乙丙丁戊己改ABCF]?)(?:遥[\u4e00-\u9fa5\d]+)?(?:运载)?火箭/);
 if(!rocketMatch)return {reason:'火箭型号未明确'};
 const rocket=`长征${chineseNumber(rocketMatch[1])}${({甲:'A',乙:'B',丙:'C',丁:'D',改:'A'})[rocketMatch[2]]||rocketMatch[2]}`;
 let result='pending';
 if(/发射(?:任务)?(?:遭遇|发生|出现|未获|未能|失利|失败)|未(?:能)?进入预定轨道/.test(lead))result='failure';
 else if(/(?:发射(?:任务)?(?:取得|获得)?(?:圆满)?成功|成功(?:将|发射)|顺利进入预定轨道)/.test(lead))result='success';
 const actual=/点火(?:升空|发射)|发射升空/.test(lead)&&!/(?:将于|拟于|定于|计划|瞄准)/.test(lead);
 if(result!=='pending'&&ts>now+60000)return {reason:'成功或失败时间尚未发生'};
 if(!actual&&result==='pending'&&!/将于|拟于|定于|计划|瞄准/.test(lead))return {reason:'计划或实际状态不明确'};
 const key=createHash('sha256').update(`${identity(mission)}|${site[1]}|${year}`).digest('hex').slice(0,20);
 return {record:{key,sourceId:source.id,sourceName:source.name,url,publishedAt,checkedAt:new Date(now).toISOString(),mission,rocket,site:{name:site[0],key:site[1],latitude:site[2],longitude:site[3]},time:new Date(ts).toISOString(),precision:dt[6]?'精确到秒':'精确到分钟',actual:actual||result!=='pending',result,crewed:/载人飞船/.test(lead)?true:/货运飞船/.test(lead)?false:null}};
}
async function fetchHTML(url,fetcher,onBytes=()=>{}){
 const response=await fetcher(url,{signal:AbortSignal.timeout(10000),redirect:'error',headers:{'User-Agent':'XingtuLaunchCalendar/0.03 (+https://space.bh1jss.net/)'}});
 if(!response.ok)throw Error(`HTTP ${response.status}`);
 const reader=response.body?.getReader();if(!reader){const t=await response.text();if(t.length>2000000)throw Error('Page too large');onBytes(Buffer.byteLength(t));return t;}
 let length=0;const chunks=[];try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;onBytes(value.length);if(length>2000000)throw Error('Page too large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 return new TextDecoder().decode(Buffer.concat(chunks));
}
export async function fetchOfficialAnnouncements(previous={}, {fetcher=fetch,now=Date.now()}={}){
 const records=new Map((previous.records||[]).map(r=>[r.url,r]));const statuses=[];const reviews=[];
 const settled=await Promise.allSettled(OFFICIAL_SOURCES.map(async source=>{
  const checkedAt=new Date(now).toISOString();let failures=0,pages=0,parsed=0,requests=0,downloadedBytes=0;const read=u=>{requests++;return fetchHTML(u,fetcher,n=>{downloadedBytes+=n;});};const links=new Map();
  const roots=await Promise.allSettled(source.lists.map(read));
  const missionRoots=[];
  roots.forEach((r,i)=>{if(r.status!=='fulfilled'){failures++;return;}pages++;
   for(const l of officialLinks(r.value,source.lists[i]))links.set(l.url,l);
   if(source.lists[i].endsWith('/fxrw/'))for(const m of r.value.matchAll(/href=["']((?:\.\/|\/fxrw\/)[^"']+\/)["']/g)){const u=new URL(m[1],source.lists[i]).href;if(!missionRoots.includes(u)&&missionRoots.length<4)missionRoots.push(u);}
  });
  for(const u of missionRoots){try{const html=await read(u);pages++;for(const l of officialLinks(html,u))if(!l.url.includes('/mtjj/'))links.set(l.url,l);}catch{failures++;}}
  const candidates=[...links.values()].slice(0,18);
  if(!pages||!links.size)failures++;
  // At most two article requests at once; recheck cached pages after six hours.
  for(let i=0;i<candidates.length;i+=2)await Promise.all(candidates.slice(i,i+2).map(async link=>{
   const old=records.get(link.url);if(old&&now-Date.parse(old.checkedAt)<6*3600000){parsed++;return;}
   try{const html=await read(link.url);pages++;const result=parseOfficialArticle(html,{...link,source,now});
    if(result.record){records.set(link.url,result.record);parsed++;}else {if(result.reason.startsWith('页面结构'))failures++;reviews.push({sourceId:source.id,url:link.url,reason:result.reason});}
   }catch(error){failures++;reviews.push({sourceId:source.id,url:link.url,reason:'读取失败，将自动重试'});}
  }));
  return {id:source.id,name:source.name,checkedAt,fetchedAt:failures?(previous.sources||[]).find(s=>s.id===source.id)?.fetchedAt||null:checkedAt,status:failures?'retrying':'ok',pages,parsed,failures,requests,downloadedBytes,totalRequests:((previous.sources||[]).find(s=>s.id===source.id)?.totalRequests||0)+requests,totalDownloadedBytes:((previous.sources||[]).find(s=>s.id===source.id)?.totalDownloadedBytes||0)+downloadedBytes};
 }));
 settled.forEach((r,i)=>statuses.push(r.status==='fulfilled'?r.value:{id:OFFICIAL_SOURCES[i].id,name:OFFICIAL_SOURCES[i].name,status:'retrying',checkedAt:new Date(now).toISOString()}));
 return {checkedAt:new Date(now).toISOString(),sources:statuses,records:[...records.values()].filter(r=>Date.parse(r.time)>now-370*86400000),reviews:reviews.slice(0,60),spacemapper:{status:'not_configured',reason:'已公开接口为轨道与编目数据，尚无已确认的发射日程接口及授权凭据'}};
}
