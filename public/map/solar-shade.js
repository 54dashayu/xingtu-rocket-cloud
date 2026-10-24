// Continuous equirectangular night polygons. Solve longitude boundaries at each
// latitude instead of classifying coarse square cells by their centre.
const rad=Math.PI/180;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function solarShadePolygons(sun,threshold=0,step=.125){
 if(!Number.isFinite(step)||step<=0||step>5||!Number.isFinite(threshold)||Math.abs(threshold)>90||!Number.isFinite(sun.latitude)||Math.abs(sun.latitude)>90||!Number.isFinite(sun.longitude))throw new RangeError('Invalid solar shade geometry');
 const rows=Math.ceil(180/step),sinD=Math.sin(sun.latitude*rad),cosD=Math.cos(sun.latitude*rad),level=Math.sin(threshold*rad);
 const bounds=[];
 for(let i=0;i<=rows;i++){
  const latitude=90-i*180/rows,phi=latitude*rad;
  const numerator=level-Math.sin(phi)*sinD,denominator=Math.cos(phi)*cosD;
  const q=Math.abs(denominator)<1e-14?(Math.abs(numerator)<1e-14?0:numerator>0?1:-1):numerator/denominator;
  const angle=Math.acos(clamp(q,-1,1))/rad;
  bounds.push({y:90-latitude,left:sun.longitude+180+angle,right:sun.longitude+540-angle});
 }
 const polygons=[];
 for(const shift of [-360,0,360]){
  const left=[],right=[];let area=false;
  for(const row of bounds){const a=clamp(row.left+shift,0,360),b=clamp(row.right+shift,0,360);left.push([a,row.y]);right.push([b,row.y]);if(b-a>1e-9)area=true;}
  if(area)polygons.push([...left,...right.reverse()]);
 }
 return polygons;
}
export function solarShadePath(sun,threshold=0){
 return solarShadePolygons(sun,threshold).map(points=>points.map(([x,y],i)=>`${i?'L':'M'}${+x.toFixed(4)},${+y.toFixed(4)}`).join('')+'Z').join('');
}
