import {isSunlit} from '../map/model.js?v=0.03-0035';
// Classify physical kilometres before display-only altitude exaggeration.
const mix=(a,b,t)=>({latitude:a.latitude+(b.latitude-a.latitude)*t,longitude:a.longitude+(((b.longitude-a.longitude+540)%360)-180)*t,height:(a.height||0)+((b.height||0)-(a.height||0))*t});
export function illuminatedSegments(points,sun){
 const result={lit:[],shadow:[]};
 const lit=p=>isSunlit(sun,p,p.height||0);
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  // Subdivide long edges to retain both crossings even when endpoint states match.
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(b.latitude-a.latitude),Math.abs(((b.longitude-a.longitude+540)%360)-180))/1));
  let left=a;
  for(let j=1;j<=steps;j++){
   const right=mix(a,b,j/steps),state=lit(left),other=lit(right);
   if(state===other)result[state?'lit':'shadow'].push(left,right);
   else {let lo=0,hi=1;for(let k=0;k<20;k++){const mid=(lo+hi)/2;if(lit(mix(left,right,mid))===state)lo=mid;else hi=mid;}
    const boundary=mix(left,right,(lo+hi)/2);result[state?'lit':'shadow'].push(left,boundary);result[other?'lit':'shadow'].push(boundary,right);}
   left=right;
  }
 }
 return result;
}
