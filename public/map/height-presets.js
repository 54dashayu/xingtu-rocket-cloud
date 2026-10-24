// UI observation-analysis cut-offs, not actual orbit or plume-visibility limits.
export const HEIGHT_PRESETS=[
 {height:100,label:'卡门线 100 km'},
 {height:150,label:'观测参考 150 km'}
];
export const DEFAULT_HEIGHT=150;
// 200 km remains available to offline diagnostics and mission-data readers.
const SUPPORTED_HEIGHTS=[...HEIGHT_PRESETS,{height:200,label:'扩展分析 200 km'}];
export function heightPreset(target){const preset=SUPPORTED_HEIGHTS.find(p=>p.height===target);if(!preset)throw new RangeError('Unsupported target height');return preset;}
