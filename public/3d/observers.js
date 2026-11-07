const LOCATION_FAILURE='定位失败，请换个环境重试，或选择城市、手动填写经纬度。';
// Approximate city-centre WGS84 coordinates for educational viewing geometry,
// not navigation or the user's exact position.
export const CITY_GROUPS=[
 ['直辖市',[['北京',39.90,116.40],['上海',31.23,121.47],['天津',39.12,117.20],['重庆',29.56,106.55]]],
 ['省会与自治区首府',[['石家庄',38.04,114.51],['太原',37.87,112.55],['呼和浩特',40.84,111.75],['沈阳',41.81,123.43],['长春',43.82,125.32],['哈尔滨',45.75,126.63],['南京',32.06,118.80],['杭州',30.27,120.15],['合肥',31.82,117.23],['福州',26.07,119.30],['南昌',28.68,115.86],['济南',36.65,117.12],['郑州',34.75,113.63],['武汉',30.59,114.30],['长沙',28.23,112.94],['广州',23.13,113.26],['南宁',22.82,108.37],['海口',20.04,110.20],['成都',30.57,104.07],['贵阳',26.65,106.63],['昆明',25.04,102.72],['拉萨',29.65,91.14],['西安',34.34,108.94],['兰州',36.06,103.83],['西宁',36.62,101.78],['银川',38.49,106.23],['乌鲁木齐',43.83,87.62]]],
 ['其他常见城市',[['深圳',22.54,114.06],['珠海',22.27,113.58],['佛山',23.02,113.12],['东莞',23.02,113.75],['厦门',24.48,118.09],['泉州',24.87,118.68],['宁波',29.87,121.55],['温州',28.00,120.70],['苏州',31.30,120.59],['无锡',31.49,120.31],['青岛',36.07,120.38],['烟台',37.46,121.45],['大连',38.91,121.61],['洛阳',34.62,112.45],['桂林',25.27,110.29],['三亚',18.25,109.51],['酒泉',39.73,98.49],['嘉峪关',39.77,98.29],['张掖',38.93,100.45],['敦煌',40.14,94.66],['包头',40.66,109.84],['文昌',19.54,110.80],['西昌',27.90,102.27]]],
 ['海外发射场周边城市',[["泰特斯维尔", 28.61222, -80.80755], ["隆波克", 34.63915, -120.45794], ["布朗斯维尔", 25.90175, -97.49748], ["库鲁", 5.16281, -52.64265], ["吉斯伯恩", -38.65333, 178.00417], ["西之表", 30.73333, 131.0], ["鹿儿岛", 31.56667, 130.55], ["拜科努尔", 45.61667, 63.31667], ["齐奥尔科夫斯基", 51.76872, 128.12018], ["米尔内", 62.76437, 40.33855], ["金奈", 13.08784, 80.27847], ["安德内斯", 69.31428, 16.11939], ["科迪亚克", 57.78852, -152.40533], ["钦科蒂格", 37.93318, -75.37881], ["阿尔坎塔拉", -2.4041, -44.41669], ["丽水（韩国）", 34.76062, 127.66215]]],
 ['港澳台城市',[['香港',22.32,114.17],['澳门',22.20,113.55],['台北',25.03,121.57],['高雄',22.63,120.30]]]
];
// Choose only a nearby entry from the curated city catalogue, never an arbitrary distant city.
export function nearestObserverCity(point,maxDistanceKm=300){
 if(!point||!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)||Math.abs(point.latitude)>90||Math.abs(point.longitude)>180)return null;
 const rad=Math.PI/180;let best=null;
 for(const [,cities] of CITY_GROUPS)for(const [name,latitude,longitude] of cities){
  const a=Math.sin((latitude-point.latitude)*rad/2)**2+Math.cos(latitude*rad)*Math.cos(point.latitude*rad)*Math.sin((longitude-point.longitude)*rad/2)**2;
  const distanceKm=6371*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,a))));
  if(distanceKm<=maxDistanceKm&&(!best||distanceKm<best.distanceKm))best={name,latitude,longitude,distanceKm};
 }
 return best;
}
export function installObservers({select,lat,lon,gpsButton,status,site,onPending,geolocation=navigator.geolocation}){
 const points=new Map();select.replaceChildren();
 for(const [group,rows] of CITY_GROUPS){const g=document.createElement('optgroup');g.label=group;for(const [name,latitude,longitude] of rows){points.set(name,[latitude,longitude]);const o=document.createElement('option');o.value=name;o.textContent=name;g.append(o);}select.append(g);}
 for(const [value,text] of [['site','发射场'],['custom','自定义经纬度'],['gps','当前位置']]){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o);}select.value='兰州';let request=0;
 function changed(){request++;gpsButton.disabled=false;const p=select.value==='site'?[site().latitude,site().longitude]:points.get(select.value);if(p){lat.value=p[0];lon.value=p[1];status.textContent='城市中心近似坐标，点击应用后生效。';}onPending();}
 select.onchange=changed;for(const input of [lat,lon])input.oninput=()=>{request++;gpsButton.disabled=false;select.value='custom';status.textContent='手动坐标，点击应用后生效。';onPending();};
 gpsButton.onclick=()=>{
  if(globalThis.isSecureContext===false){status.textContent=LOCATION_FAILURE;return;}
  const policy=globalThis.document?.permissionsPolicy||globalThis.document?.featurePolicy;
  if(policy?.allowsFeature&&!policy.allowsFeature('geolocation')){status.textContent=LOCATION_FAILURE;return;}
  if(!geolocation){status.textContent=LOCATION_FAILURE;return;}
  const id=++request;gpsButton.disabled=true;status.textContent='正在请求浏览器位置… 已授权的网站通常不会再次弹窗。';
  let finished=false;
  const finish=()=>{if(id!==request||finished)return false;finished=true;clearTimeout(timer);gpsButton.disabled=false;return true;};
  const timer=setTimeout(()=>{if(!finish())return;status.textContent=LOCATION_FAILURE;},55000);timer.unref?.();
  const failed=e=>{
   if(!finish())return;
   status.textContent=LOCATION_FAILURE;
  };
  const success=p=>{if(!finish())return;const c=p.coords;if(!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude)||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180){status.textContent=LOCATION_FAILURE;return;}lat.value=c.latitude.toFixed(6);lon.value=c.longitude.toFixed(6);select.value='gps';status.textContent=`已取得位置${Number.isFinite(c.accuracy)?'，精度约 '+Math.round(c.accuracy)+' 米':''}；点击应用后生效。`;onPending();};
  function locate(highAccuracy){
   try{geolocation.getCurrentPosition(success,e=>{
    if(id!==request||finished)return;
    if(!highAccuracy&&(e.code===2||e.code===3)){status.textContent='普通定位未取得位置，正在尝试高精度定位（最长30秒）…';locate(true);}else failed(e);
   },{enableHighAccuracy:highAccuracy,timeout:highAccuracy?30000:12000,maximumAge:highAccuracy?0:60000});}catch(e){failed({code:e.name==='SecurityError'?1:2,message:e.message});}
  }
  locate(false);
 };
 return {setObserver:changed};
}
