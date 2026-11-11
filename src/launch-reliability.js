// Evidence completeness is separate from the physical cloud index.
// No source-count voting: copied articles and derived notice headings are not independent truth.
export function launchReliability(launch){
 const sources=launch.sources||[];
 const ll2=sources.some(s=>/^https:\/\/(?:ll\.)?thespacedevs\.com\//.test(s.url||''));
 const official=launch.officialVerification;
 const notice=launch.warningDiscovery||launch.warningReference;
 const candidate=launch.provenance?.kind==='navigation_warning_candidate';
 const validBearing=n=>Number.isFinite(n)&&n>=0&&n<360;
 const t=launch.trajectory;
 const sourcedHeading=t?.launchId===launch.id&&t?.net===launch.timing?.net&&validBearing(t.azimuth)&&/^https:\/\//.test(t.sourceUrl||'')&&Number.isFinite(Date.parse(t.publishedAt));
 const noticeHeading=validBearing(notice?.headingEstimate);
 const precise=Number.isFinite(Date.parse(launch.timing?.net))&&/分钟|秒|小时|minute|second|hour/i.test(launch.timing?.precision||'');
 const start=Date.parse(launch.timing?.windowStart),end=Date.parse(launch.timing?.windowEnd);
 const window=launch.timing?.basis==='notice_window'&&Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=7200000;
 const coordinates=launch.pad?.latitude!=null&&launch.pad?.longitude!=null&&Number.isFinite(Number(launch.pad.latitude))&&Math.abs(Number(launch.pad.latitude))<=90&&Number.isFinite(Number(launch.pad.longitude))&&Math.abs(Number(launch.pad.longitude))<=180;
 const inactive=['cancelled','postponed'].includes(launch.scheduleStatus?.code);
 const fields={
  identity:{level:official?'official':ll2?'catalogued':candidate?'unverified':'supplement',label:official?'官网核对':ll2?'LL2 收录':candidate?'任务身份待核实':'补充资料'},
  time:{level:window?'notice_window':precise?(official?'official':'scheduled'):'pending',label:window?'航警时间窗':precise?(official?'官网时间':'任务计划时间'):'时刻待补充'},
  direction:sourcedHeading?{level:'sourced_heading',label:'有来源的任务航向',degrees:t.azimuth,url:t.sourceUrl}:{level:noticeHeading?'notice_estimate':'pending',label:noticeHeading?'航警方向估算':'具体航向待补充',...(noticeHeading?{degrees:notice.headingEstimate}:{})},
  site:{level:coordinates?(candidate?'inferred':'known'):'pending',label:coordinates?(candidate?'航警推断场址':'已有场址'):'场址待补充'}
 };
 const mode=inactive?'inactive':coordinates&&window&&noticeHeading?'notice_window':coordinates&&precise?'scheduled':'pending';
 return {version:1,primarySource:ll2?'LL2':official?.sourceName|| (candidate?'航警线索':'补充资料'),
  corroboration:[...(official?[{type:'official',name:official.sourceName,url:official.url}]:[]),...(notice?[{type:'navigation_warning',noticeIds:notice.noticeIds||[],estimated:true}]:[])],fields,
  label:official?'官方核对':ll2?(noticeHeading?'LL2 · 航警参考':'LL2 收录'):candidate?'航警线索 · 待核实':'补充资料',
  assessment:{eligible:['notice_window','scheduled'].includes(mode),mode,reason:mode==='notice_window'?'按航警窗口和估算航向评估':mode==='scheduled'?'按任务时刻评估；缺少实际航向时使用标明的参考情景':inactive?'任务已取消或推迟':'时间、场址或窗口航向待补充'},
  note:'任务资料可靠度与火箭云几何指数分开；有利光照不代表任务身份已确认。'};
}
