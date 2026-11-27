import {PROPULSION_RECORDS,PROPULSION_DATABASE_VERSION} from './propulsion-data.js?v=0.03-0035';
// Shared pure data/model module. Generated CommonJS copy is used by WeChat.
export const PROPULSION_VERSION = 'propulsion-20261123-3:'+PROPULSION_DATABASE_VERSION;
export const FUEL_LIMIT = '推进剂修正为未校准的敏感性情景，不是实测亮度或可见概率；分值区间不是统计置信区间。';
// Deliberately broad DESIGN priors, not measured optical coefficients. Upper
// bound preserves geometry. Do not use these to exclude a launch or viewing area.
export const FUELS = {
 kerolox:{label:'液氧煤油',range:[.75,1],note:'含水排气与碳质颗粒可能形成尾迹，明显程度取决于高空条件和光照。'},
 methalox:{label:'液氧甲烷',range:[.8,1],note:'含水排气可凝结形成尾迹；低烟不等于没有高空火箭云。'},
 hydrolox:{label:'液氧液氢',range:[.8,1],note:'排气富含水，在适宜条件下可凝结形成明亮尾迹。'},
 hypergolic:{label:'四氧化二氮/偏二甲肼',short:'常温液体',range:[.6,1],note:'排气也含水，不能判定不会形成火箭云；短时烟雾不代表高空尾迹亮度。'},
 hypergolic_mmh:{label:'四氧化二氮/一甲基肼',short:'常温液体',range:[.6,1],note:'与其他常温双组元共用未校准的敏感性范围，不表示已测得相同云气亮度。'},
 liquid_unspecified:{label:'液体（组合待核实）',short:'液体',range:[1,1],note:'具体推进剂组合尚未核实，本级不施加燃料权重修正。'},
 solid:{label:'固体',range:[.85,1],note:'固体推进剂通常产生颗粒烟迹，具体表现取决于配方；烟多不等于远处必然可见。'}
};
const sources={
 ariane:'https://www.esa.int/Enabling_Support/Space_Transportation/Ariane/The_engines_of_Ariane_6',
 sd:'https://www.spacechina.com/n25/n146/n238/n12985/c3961284/content.html'
};
const stage=(id,fuel,name)=>({id,fuel,name});
const record=(id,pattern,fuels,boosters,source)=>({id,pattern,stages:fuels.map((f,i)=>stage('stage'+(i+1),f,i===0?'芯一级':(i+1)+'级')),boosters,source});
const databaseAliases=new Map(PROPULSION_RECORDS.flatMap(r=>r.aliases.map(a=>[a.toLowerCase(),r])));
const catalog=[
 record('ariane62',/^(Ariane 62|阿丽亚娜62号?)$/i,['hydrolox','hydrolox'],[{id:'booster',fuel:'solid',name:'助推器',count:2}],sources.ariane),
 record('ariane64',/^(Ariane 64|阿丽亚娜64号?)$/i,['hydrolox','hydrolox'],[{id:'booster',fuel:'solid',name:'助推器',count:4}],sources.ariane),
 record('sd3',/^(Smart Dragon 3|Jielong-3|捷龙三号|捷龙3号?)$/i,['solid','solid','solid','solid'],[],sources.sd)
];
export function propulsionInfo(launch={}){
 const name=String(launch.originalRocket||launch.rocket||'').trim();
 const r=databaseAliases.get(name.toLowerCase())||catalog.find(r=>r.pattern.test(name));
 if(!r)return {version:PROPULSION_VERSION,known:false,summary:'推进剂待核实',stages:[],boosters:[],details:[],sources:[]};
 const components=[...r.stages,...r.boosters];
 const short=f=>FUELS[f].short||FUELS[f].label;
 return {version:PROPULSION_VERSION,known:true,configuration:r.id,
 databaseVersion:PROPULSION_DATABASE_VERSION,provider:r.provider||null,referenceBasis:r.referenceBasis||'model_reference',fuelComplete:components.every(c=>c.fuel!=='liquid_unspecified'),configurationScope:r.configurationScope||null,boostersKnown:r.boostersKnown!==false,
 summary:'推进剂：'+short(r.stages[0].fuel)+(r.boosters.length?'｜助推器：'+short(r.boosters[0].fuel):''),
 stages:r.stages,boosters:r.boosters,
 details:components.map(c=>({...c,text:c.name+(c.count?'×'+c.count:'')+'：'+FUELS[c.fuel].label+'。'+FUELS[c.fuel].note})),
 sources:r.sources||[{name:'官方推进剂资料',url:r.source,role:'primary'}],checkedAt:r.checkedAt||'2026-11-23'};
}
// Optional mission-specific intervals: do not infer booster separation from the
// generic two-stage reference rocket. At emission time, not observation time.
export function fuelRange(launch,parcel){
 const info=propulsionInfo(launch);if(!info.known)return {min:1,max:1,known:false,basis:'推进剂待核实，仅几何分'};
 const components=[...info.stages,...info.boosters];
 const timeline=launch.propulsionTimeline;
 const valid=info.boostersKnown!==false&&Boolean(timeline&&launch.id&&launch.timing?.net)&&timeline.launchId===launch.id&&timeline.net===launch.timing?.net&&/^https:\/\//.test(timeline.sourceUrl||'')&&
  Array.isArray(timeline.intervals)&&timeline.intervals.length>0&&timeline.intervals.every(x=>components.some(c=>c.id===x.component)&&Number.isFinite(x.start)&&Number.isFinite(x.end)&&x.start>=0&&x.end>x.start)&&
  components.every(c=>timeline.intervals.some(x=>x.component===c.id));
 const active=valid?components.filter(c=>timeline.intervals.some(x=>x.component===c.id&&parcel.seconds>=x.start&&parcel.seconds<x.end)):components;
 if(!active.length)return {min:0,max:0,known:true,basis:'资料关机段'};
 const ranges=active.map(c=>FUELS[c.fuel].range);
 return {min:valid?Math.max(...ranges.map(r=>r[0])):Math.min(...ranges.map(r=>r[0])),max:Math.max(...ranges.map(r=>r[1])),known:active.every(c=>c.fuel!=='liquid_unspecified'),
 basis:valid?'按有来源的级段喷气时段':info.fuelComplete?'级段时序未提供，采用各推进剂情景范围':'部分推进剂待核实；仅修正已知燃料，未知部分保留几何权重'};
}
