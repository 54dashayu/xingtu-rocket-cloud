import {morphologyAssessment} from './morphology.js?v=0.03-0035';
import {propulsionInfo,FUEL_LIMIT,FUELS} from './propulsion.js?v=0.03-0035';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function propulsionSummary(l){return esc(propulsionInfo(l).summary);}
export function propulsionDetails(l){const p=propulsionInfo(l);return `<details class="propulsion-details"><summary>推进剂与云迹</summary>${p.known?p.details.map(d=>`<p>${esc(d.text)}</p>`).join(''):'<p>型号资料待补充，不据此降低几何关注度。</p>'}<p class="morphology-note">${esc(morphologyAssessment(l).label)}。${esc(morphologyAssessment(l).limits)}</p><p>${esc(FUEL_LIMIT)}</p>${p.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)} ↗</a>`).join('')}</details>`;}

// Rebuild from the local component catalogue, never from a cached summary.
// These are model/configuration references, not confirmed mission burn timings.
export function propulsionHeader(launch){
 if(!launch)return '<span>推进剂：待选择任务</span>';
 const p=propulsionInfo(launch);
 if(!p.known)return '<span>推进剂：待核实</span>';
 const fuel=c=>c.fuel==='liquid_unspecified'?'液体（组合待核实）':(FUELS[c.fuel]?.short||FUELS[c.fuel]?.label||'待核实');
 const part=(label,components)=>{
  const value=components.map(c=>`${c.count?'×'+c.count+' ':''}${fuel(c)}`).join('、');
  const full=components.map(c=>`${c.name}：${FUELS[c.fuel]?.label||'待核实'}`).join('；');
  return `<span title="${esc(full)}"><b>${esc(label)}</b>${esc(value)}</span>`;
 };
 const parts=[p.stages[0]?part('芯一级：',[p.stages[0]]):'<span>芯一级：待核实</span>'];
 // Keep every subsequent stage distinct: a third stage may use a different fuel.
 for(const c of p.stages.slice(1))parts.push(part(`上面级·${c.name}：`,[c]));
 if(p.boosters.length)parts.push(part('助推器：',p.boosters));
 if(p.boostersKnown===false)parts.push('<span>助推器构型：待核实</span>');
 return parts.join('');
}
