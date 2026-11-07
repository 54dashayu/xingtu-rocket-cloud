import {weatherAt} from './weather.js';

// One explicit observation location/time. No launch-pad or regional fallback.
export async function observerWeather(params,{weatherEnabled=true,weatherProvider=weatherAt,...options}={}){
 if(!weatherEnabled)return {status:'disabled',label:'此版本未提供天气预测',points:[]};
 const lat=params.get('latitude'),lon=params.get('longitude'),time=params.get('time');
 const latitude=Number(lat),longitude=Number(lon),ms=Date.parse(time);
 if(!lat?.trim()||!lon?.trim()||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180||!Number.isFinite(ms)||!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(time||''))throw new RangeError('请提供有效观测坐标和带时区的时间');
 const observer={latitude,longitude};
 const result=await weatherProvider([observer],new Date(ms).toISOString(),options);
 return {...result,observer,requestedTime:new Date(ms).toISOString(),scope:'observer'};
}
