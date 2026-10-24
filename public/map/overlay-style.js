// Labels distinguish a historical model calculation from observed evidence.
export function trajectoryStyle(kind,history=false){
 if(kind==='measured')return {label:'实测上升轨迹',color:'#087e68',dash:null};
 if(kind==='reconstructed')return {label:'数据重建轨迹',color:'#156d99',dash:'8 3'};
 if(kind==='planned')return {label:'公布计划轨迹',color:'#285bd3',dash:'9 4'};
 return {label:history?'上升轨迹模拟':'预测上升轨迹',color:'#e45d24',dash:'9 5'};
}
// Outline the actual grid union, not a bounding circle. Dateline neighbours wrap.
export function regionEdges(cells){
 const wrap=x=>((x+180)%360+360)%360-180,key=(lat,lon)=>`${lat},${wrap(lon)}`;
 const set=new Set(cells.map(p=>key(p.latitude,p.longitude))),edges=[];
 for(const p of cells){const x=p.longitude+180,y=90-p.latitude;
  if(!set.has(key(p.latitude+1,p.longitude)))edges.push([[x-.5,y-.5],[x+.5,y-.5]]);
  if(!set.has(key(p.latitude-1,p.longitude)))edges.push([[x-.5,y+.5],[x+.5,y+.5]]);
  if(!set.has(key(p.latitude,p.longitude-1)))edges.push([[x-.5,y-.5],[x-.5,y+.5]]);
  if(!set.has(key(p.latitude,p.longitude+1)))edges.push([[x+.5,y-.5],[x+.5,y+.5]]);
 }
 return edges;
}
