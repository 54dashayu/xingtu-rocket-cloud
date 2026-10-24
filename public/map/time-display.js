import { padTimezone } from './sun-events.js?v=20261024ad';
const formats=new Map();
function format(ms,zone,dateOnly=false){
  const key=`${zone}|${dateOnly}`;
  if(!formats.has(key))formats.set(key,new Intl.DateTimeFormat('zh-CN',{timeZone:zone,month:'2-digit',day:'2-digit',...(dateOnly?{}:{hour:'2-digit',minute:'2-digit'}),hourCycle:'h23'}));
  return formats.get(key).format(new Date(ms));
}
export function timePair(date,pad={},dateOnly=false){
  const ms=typeof date==='number'?date:Date.parse(date);
  const zone=padTimezone(pad),known=!zone.source.includes('缺失');
  if(!Number.isFinite(ms))return {local:'待定',beijing:'待定',zone:zone.name,known,sameBeijing:zone.name==='Asia/Shanghai'};
  const sameBeijing=known&&format(ms,zone.name)===format(ms,'Asia/Shanghai');
  return {local:known?format(ms,zone.name,dateOnly):'时区待补充',beijing:format(ms,'Asia/Shanghai',dateOnly),zone:zone.name,known,sameBeijing};
}
export function launchTimePair(launch){
  const precision=launch.timing?.precision || '';
  if(!Number.isFinite(Date.parse(launch.timing?.net))||/month|quarter|year|月份|季度|年份/i.test(precision))return {...timePair(null,launch.pad),note:precision || '时间待定'};
  const timed=/分钟|秒|小时|minute|second|hour/i.test(precision) && !['tbd','approximate','postponed','cancelled'].includes(launch.scheduleStatus?.code);
  // Coarse dates are displayed as dates in both zones, never as fabricated midnight clocks.
  return {...timePair(launch.timing.net,launch.pad,!timed),note:timed?precision:`日期参考 · ${precision || '时刻待定'}`};
}
