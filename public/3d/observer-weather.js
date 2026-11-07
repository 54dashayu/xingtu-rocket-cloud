export function observerWeatherRequest(scenario,observer,window){
 const seconds=window.windows[0]?.start??0;
 const time=new Date(Date.parse(scenario.launch.timing.net)+seconds*1000).toISOString();
 return {params:new URLSearchParams({latitude:String(observer.latitude),longitude:String(observer.longitude),time}),
  time,hasWindow:window.possible};
}

// Abort the previous request and reject late results even if abort is ignored.
export function createObserverWeatherController({render,fetcher=fetch,endpoint='../api/observer-weather',enabled=true}){
 let generation=0,controller;
 return {
  clear(){generation++;controller?.abort();render({state:'idle'});},
  async update(scenario,observer,window,name='所选地点'){
   const token=++generation;controller?.abort();
   if(!enabled){render({state:'disabled'});return;}
   controller=new AbortController();
   const request=observerWeatherRequest(scenario,observer,window),context={...request,name,observer:{...observer}};
   render({state:'loading',...context});
   const timer=setTimeout(()=>controllerForRequest.abort(),18000),controllerForRequest=controller;
   try{
    const response=await fetcher(endpoint+'?'+request.params,{signal:controller.signal});
    if(!response.ok)throw Error('天气暂不可用');
    const result=await response.json();
    if(token===generation)render({state:'ready',...context,result});
   }catch(error){if(token===generation)render({state:'error',...context});}
   finally{clearTimeout(timer);}
  }
 };
}
