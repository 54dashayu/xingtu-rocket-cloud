// SVG map navigation. Convert client coordinates through the root SVG matrix so
// dragging and zoom anchors also work in the letterboxed parts of the map.
export function installMapNavigation({world, viewport, zoomIn, zoomOut, reset, back, onExitFocus, onChange, onInteract}) {
 const minScale=.75,maxScale=12;
 const home={scale:1,x:-150,y:0};
 let previousView=null,focusMode=false;
 let view={...home},gesture=null,moved=false,suppressClickUntil=0;
 const pointers=new Map();
 const point=(x,y)=>new DOMPoint(x,y).matrixTransform(world.getScreenCTM().inverse());
 function paint(next) {
  view={scale:Math.max(minScale,Math.min(maxScale,next.scale)),x:next.x,y:next.y};
  // Longitude repeats continuously; normalize by one world without a visible jump.
  const width=360*view.scale;
  view.x=-(((-view.x%width)+width)%width);
  view.y=Math.max(135-180*view.scale,Math.min(45,view.y));
  viewport.setAttribute('transform',`translate(${view.x} ${view.y}) scale(${view.scale})`);
  zoomIn.disabled=view.scale>=maxScale;zoomOut.disabled=view.scale<=minScale;
  if(back)back.hidden=!previousView;
  onChange({...view});
 }
 function zoom(factor,anchor={x:180,y:90}) {
  if(!previousView)previousView={...view};
  onInteract();const scale=Math.max(minScale,Math.min(maxScale,view.scale*factor)),ratio=scale/view.scale;
  paint({scale,x:anchor.x-(anchor.x-view.x)*ratio,y:anchor.y-(anchor.y-view.y)*ratio});
 }
 function begin() {
  const pts=[...pointers.values()];
  gesture=pts.length?{view:{...view},points:pts.slice(0,2).map(p=>({...p}))}:null;
 }
 world.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  if(!pointers.size){moved=false;world.focus({preventScroll:true});}
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});begin();
  if(pointers.size>1){onInteract();moved=true;}
 });
 world.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||!gesture)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const pts=[...pointers.values()].slice(0,2),start=gesture.points;
  if(!moved&&Math.hypot(pts[0].x-start[0].x,pts[0].y-start[0].y)<4)return;
  moved=true;onInteract();world.classList.add('dragging');
  // Capture only after a drag starts, preserving ordinary clicks on site marks.
  for(const id of pointers.keys())if(!world.hasPointerCapture(id))world.setPointerCapture(id);
  const center=a=>a.length>1?{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}:a[0];
  const a=center(start),b=center(pts),from=point(a.x,a.y),to=point(b.x,b.y);
  const distance=a=>Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y);
  const factor=pts.length>1&&start.length>1?distance(pts)/Math.max(1,distance(start)):1;
  const scale=Math.max(minScale,Math.min(maxScale,gesture.view.scale*factor)),ratio=scale/gesture.view.scale;
  paint({scale,x:to.x-(from.x-gesture.view.x)*ratio,y:to.y-(from.y-gesture.view.y)*ratio});
 });
 function end(e) {
  if(!pointers.has(e.pointerId))return;
  pointers.delete(e.pointerId);
  if(moved)suppressClickUntil=performance.now()+350;
  if(!pointers.size)world.classList.remove('dragging');
  begin();
 }
 for(const event of ['pointerup','pointercancel'])world.addEventListener(event,end);
 // Touch starts with implicit capture on a child. Its bubbling capture-loss
 // event during transfer to the SVG must not remove an active finger.
 world.addEventListener('lostpointercapture',e=>{if(e.target===world&&!world.hasPointerCapture(e.pointerId))end(e);});
 world.addEventListener('pointerleave',e=>{if(!world.hasPointerCapture(e.pointerId))end(e);});
 world.addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
 world.addEventListener('wheel',e=>{
  e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?world.clientHeight:1;
  zoom(Math.exp(-Math.max(-400,Math.min(400,e.deltaY*unit))*.002),point(e.clientX,e.clientY));
 },{passive:false});
 world.addEventListener('dblclick',e=>{if(e.target.closest('.site'))return;e.preventDefault();zoom(e.shiftKey?.5:2,point(e.clientX,e.clientY));});
 zoomIn.onclick=()=>zoom(1.4);zoomOut.onclick=()=>zoom(1/1.4);
 reset.onclick=()=>{onInteract();previousView=null;focusMode=false;onExitFocus?.();paint(home);};
 if(back)back.onclick=()=>{if(!previousView)return;onInteract();const saved=previousView;previousView=null;focusMode=false;onExitFocus?.();paint(saved);};
 world.addEventListener('keydown',e=>{
  if(e.target!==world)return;
  if(['+','=','-','0','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();else return;
  if(e.key==='+'||e.key==='=')zoom(1.4);else if(e.key==='-')zoom(1/1.4);
  else if(e.key==='0'||e.key==='Home')reset.click();
  else {onInteract();paint({...view,x:view.x+({ArrowLeft:18,ArrowRight:-18}[e.key]||0),y:view.y+({ArrowUp:18,ArrowDown:-18}[e.key]||0)});}
 });
 paint(view);
 return {isDragging:()=>pointers.size>0&&moved,focus:(location,scale=4)=>{if(!focusMode)previousView={...view};focusMode=true;onInteract();paint({scale,x:180-(location.longitude+180)*scale,y:90-(90-location.latitude)*scale});}};
}
