// Shared paint colors and alpha; disjoint cells avoid stacking opacity.
export const AREA_OPACITY=.48;
export const AREA_COLORS=Object.freeze({
 jellyfish:{color:'#376bad',label:'水母云关注区',detail:'分离阶段参考高度以上 · 仰角≥5°'},
 higher:{color:'#668fb7',label:'较暗天空',detail:'太阳低于−6° · 仰角≥5°'},
 twilight:{color:'#8db3d4',label:'暮光天空',detail:'太阳−6°至−1° · 仰角≥5°'},
 low:{color:'#b9d4e5',label:'低仰角边缘',detail:'仰角1–5° · 易遮挡'}
});

// Nine display tones by ground solar altitude, not observer-to-plume viewing direction.
// Display ramp only: twilight edge (-1 deg) lighter, deeper night (-12 deg) darker.
export function groundLightTone(solarAltitude){return Math.round(8*Math.max(0,Math.min(1,(solarAltitude+12)/11)));}
// Retained for viewing-angle analysis, no longer used for map colors.
export function directionTone(separation=90){return Math.round(8*(1-Math.max(0,Math.min(1,(separation-30)/120))));}
export function areaFill(band,tone=0){
 const hex=AREA_COLORS[band].color.slice(1),amount=Math.max(0,Math.min(8,tone))/8*.28;
 return '#'+[0,2,4].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*(1-amount)+255*amount).toString(16).padStart(2,'0')).join('');
}
export function areaLegend(){return `<div class="area-color-legend">${Object.entries(AREA_COLORS).map(([key,item])=>`<div class="area-color-row"><i aria-hidden="true" data-area-swatch="${key}" style="opacity:${AREA_OPACITY};background:linear-gradient(90deg,${areaFill(key,8)},${areaFill(key,0)})"></i><span><b>${item.label}</b><small>${item.detail}</small></span></div>`).join('')}</div><p class="view-direction-key">同一分区：向阳侧浅 → 背阳侧深<br><small>按地面太阳高度着色；半透明保留晨昏线，不代表可见概率。</small></p>`;}
