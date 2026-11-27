// Mission-specific evidence. A crew-capable spacecraft is not necessarily crewed at launch.
export const CREW_VERSION='crew-20261123-1';
const evidence=[
 {number:24,year:2026,value:true,publishedAt:'2026-11-07',sourceName:'中国载人航天工程办公室',url:'https://www.cmse.gov.cn/xwzx/202611/t20261106_57849.html',basis:'官方明确命名为神舟二十四号载人飞行任务（计划）'},
 {number:23,year:2026,value:true,publishedAt:'2026-05-25',sourceName:'中国载人航天工程办公室',url:'https://www.cmse.gov.cn/xwzx/202605/t20260525_57561.html',basis:'发射公告确认航天员乘组在轨状态良好'},
 {number:22,year:2025,value:false,publishedAt:'2025-11-25',sourceName:'国防部网站（新华社报道）',url:'https://www.mod.gov.cn/gfbw/gfjy_index/16423701.html',basis:'此次为无人状态应急发射，不因返回时搭载航天员改为载人发射'},
 {number:8,year:2011,value:false,publishedAt:'2011-10-31',sourceName:'中国载人航天工程办公室',url:'https://www.cmse.gov.cn/fxrw/tgyhyszbhrw/rwgk/201110/t20111031_38220.html',basis:'官方新闻发布会明确本次为无人飞行'}
];
function number(text){if(/^\d+$/.test(text))return +text;const digits='零一二三四五六七八九';let n=0,v=0;for(const c of text){if(c==='十'){n+=(v||1)*10;v=0;}else v=digits.indexOf(c);}return n+v;}
export function shenzhouNumber(l){
 const values=[l.mission?.originalName,l.mission?.name,l.originalName?.split(/[|｜]/).at(-1),l.name?.split(/[|｜]/).at(-1)].filter(Boolean);
 const found=values.map(s=>String(s).trim().match(/^(?:shenzhou[ -]*|神舟)(\d+|[一二三四五六七八九十]+)(?!\d)(?:号|\b|(?=载人|飞船|飞行))/i)).filter(Boolean).map(m=>number(m[1]));
 return found.length&&new Set(found).size===1?found[0]:null;
}
export function withCrewStatus(l){
 const no=shenzhouNumber(l),year=new Date(l.timing?.net).getUTCFullYear();
 const curated=evidence.find(e=>e.number===no&&e.year===year);
 const existing=l.crewEvidence;
 const chosen=existing?.kind==='official'&&typeof existing.value==='boolean'&&(!curated||Date.parse(existing.publishedAt)>=Date.parse(curated.publishedAt))?existing:curated?{...curated,kind:'official',checkedAt:'2026-11-23'}:existing;
 const value=chosen&&typeof chosen.value==='boolean'?chosen.value:typeof l.crewed==='boolean'?l.crewed:null;
 return {...l,crewed:value,crewEvidence:chosen||null,crewStatus:value===true?'crewed':value===false?'uncrewed':'unknown',
  crewLabel:value===true?'载人任务':value===false?'非载人任务':'载人情况待核实',
  sources:chosen?.url?[...(l.sources||[]).filter(s=>s.url!==chosen.url),{name:chosen.sourceName+' · 载人属性',url:chosen.url}]:l.sources};
}
// Only the already identified launch sentence is accepted, never a sidebar.
export function officialCrewValue(text){
 if(/无人(?:状态|飞行|飞船|试验)|不搭载航天员|未搭载航天员|货运飞船/.test(text))return false;
 if(/载人飞行任务|航天员乘组(?:状态|由)|搭载.{0,30}(?:名航天员|航天员.{0,20}(?:进入|升空))/.test(text))return true;
 return null;
}
