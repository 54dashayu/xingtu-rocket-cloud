// CGCS2000 geographic WMTS: level 1 has 2 columns and 1 row,
// with its origin at 90 N, 180 W. Matches our lon+180 / 90-lat plane.
export function tilePlan(bounds,pixelsPerDegree){
 const zoom=Math.max(1,Math.min(10,Math.floor(Math.log2(Math.max(1,pixelsPerDegree)*360/256))));
 const columns=2**zoom,span=360/columns,rows=columns/2;
 const firstRow=Math.max(0,Math.floor(bounds.top/span)),lastRow=Math.min(rows-1,Math.floor(bounds.bottom/span));
 const firstCol=Math.floor(bounds.left/span),lastCol=Math.min(firstCol+columns-1,Math.floor(bounds.right/span));
 const tiles=[];
 for(let y=firstRow;y<=lastRow;y++)for(let x=firstCol;x<=lastCol;x++)tiles.push({x:((x%columns)+columns)%columns,y});
 return {zoom,span,tiles,labels:zoom>=4};
}
export function tileURL(token,layer,zoom,x,y){
 const params=new URLSearchParams({SERVICE:'WMTS',REQUEST:'GetTile',VERSION:'1.0.0',LAYER:layer,STYLE:'default',TILEMATRIXSET:'c',FORMAT:'tiles',TILEMATRIX:String(zoom),TILEROW:String(y),TILECOL:String(x),tk:token});
 return `https://t0.tianditu.gov.cn/${layer}_c/wmts?${params}`;
}
export function installTianditu({world,viewport,base,labels,credit,error}){
 let token='',timer,serial=0,signature='',enabled=false;
 const ns='http://www.w3.org/2000/svg';
 function schedule(){clearTimeout(timer);timer=setTimeout(paint,100);}
 function paint(){
  if(!enabled||!world.clientWidth||!world.clientHeight)return;
  const matrix=viewport.getScreenCTM();if(!matrix)return;
  const rect=world.getBoundingClientRect(),inverse=matrix.inverse();
  const a=new DOMPoint(rect.left,rect.top).matrixTransform(inverse),b=new DOMPoint(rect.right,rect.bottom).matrixTransform(inverse);
  const plan=tilePlan({left:a.x,right:b.x,top:a.y,bottom:b.y},Math.hypot(matrix.a,matrix.b));
  const key=JSON.stringify(plan);if(key===signature)return;signature=key;
  world.dataset.tileZoom=String(plan.zoom);world.dataset.placeLabels=String(plan.labels);
  const generation=++serial;
  const needed=new Set();let failures=0;
  for(const layer of ['vec',...(plan.labels?['cva']:[])]){
   const group=layer==='vec'?base:labels;
   for(const t of plan.tiles){
    const id=`${layer}/${plan.zoom}/${t.x}/${t.y}`;needed.add(id);
    if([...group.children].some(n=>n.dataset.tile===id))continue;
    const n=document.createElementNS(ns,'image');n.dataset.tile=id;
    for(const [k,v] of Object.entries({x:t.x*plan.span,y:t.y*plan.span,width:plan.span,height:plan.span,preserveAspectRatio:'none'}))n.setAttribute(k,v);
    n.onload=()=>{if(generation===serial){world.dataset.basemapLoaded='true';if(error.dataset.provider==='tianditu'){error.textContent='';delete error.dataset.provider;}}};
    n.onerror=()=>{if(generation!==serial)return;failures++;if(failures>=2){error.dataset.provider='tianditu';error.textContent='天地图部分图块未加载，请稍后缩放重试。';}n.remove();signature='';};
    n.setAttribute('href',tileURL(token,layer,plan.zoom,t.x,t.y));group.append(n);
   }
  }
  for(const group of [base,labels])for(const n of [...group.children])if(!needed.has(n.dataset.tile))n.remove();
  credit.replaceChildren();const link=document.createElement('a');link.href='https://www.tianditu.gov.cn/';link.target='_blank';link.rel='noopener noreferrer';link.textContent='地图来源：天地图';credit.append(link,document.createTextNode(plan.labels?' · 中文地名随缩放显示':' · 放大后显示地名'));
 }
 async function start(){
  try{const r=await fetch('./api/map-config');if(!r.ok)throw Error();const cfg=await r.json();if(!cfg.token)return;token=cfg.token;enabled=true;world.dataset.basemap='tianditu';paint();}
  catch{error.dataset.provider='tianditu';error.textContent='天地图配置暂不可用，当前显示简化底图。';}
 }
 new ResizeObserver(schedule).observe(world);
 void start();return {schedule};
}
