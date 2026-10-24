// User-facing wording only; keep the scientific assessment and thresholds unchanged.
export function assessmentCopy(result,{historical=false,scenario=false}={}){
 const m=result.model,w=result.weather,c=w.counts||{};
 const past=historical&&!scenario;
 const when=past?'当时':'';
 const counts={clearer:c.clearer||0,mixed:c.mixed||0,obstructed:c.obstructed||0,missing:c.missing||0};
 const total=Object.values(counts).reduce((a,b)=>a+b,0);
 const context=scenario?'按你设置的时间或方向试算':past?'根据发射时的光照和历史天气估算':'根据预计发射时的光照和天气估算';
 const base={context,total,counts,limited:'只查看了部分参考地点；你所在位置还需结合当地天气和现场遮挡判断。'};
 if(m.code==='pending')return {...base,title:'发射时间或地点还未确定',light:'暂时无法判断哪里适合观看。',weather:'确定发射时间和地点后，再来查看天气建议。'};
 if(m.code==='preliminary')return {...base,title:'飞行资料还不够，暂时无法判断',light:'还不能确定可能观看的范围。',weather:'补充飞行资料后，才能查看相关地点的天气。'};
 if(m.code!=='possible')return {...base,title:'暂未找到适合观看的区域',light:'按当前时间和轨迹估算，尚未找到光照和观看角度都合适的地方。',weather:'暂不提供观看地点的天气建议。'};
 const light=past?'光照和位置条件：当时部分地方有机会看到受阳光照亮的尾迹。':'光照和位置条件：部分地方有机会看到受阳光照亮的尾迹。';
 if(!counts.clearer&&!counts.mixed&&!counts.obstructed){
  const distant=w.status==='outside_horizon';
  return {...base,title:distant?'有观看机会，天气还需再等等':'有观看机会，天气暂时查不到',light,weather:distant?'距离发射还早，临近日期再查看天气预报。':'天气资料暂未齐全，可稍后点击“重新查看”。'};
 }
 const title=counts.clearer?(past?'当时部分地点天气较好':'部分地点天气较好，可以留意'):counts.mixed?`${when}天气条件一般，观看可能受影响`:`${when}已查到的地点天气不利于观看`;
 const parts=[];
 if(counts.clearer)parts.push(`${counts.clearer} 个天气较好`);
 if(counts.mixed)parts.push(`${counts.mixed} 个天气一般`);
 if(counts.obstructed)parts.push(`${counts.obstructed} 个可能受云雨或低能见度影响`);
 if(counts.missing)parts.push(`${counts.missing} 个暂时没有天气资料`);
 return {...base,title,light,weather:`查看的 ${total} 个参考地点中，${parts.join('，')}。`};
}
