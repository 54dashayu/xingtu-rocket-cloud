(() => {
  const full = document.querySelector('#cache-monitor');
  const summary = document.querySelector('#cache-summary');
  if (!full && !summary) return;
  const names = {'rocket-cloud':'火箭云 / 共享数据刷新', 'launch-calendar':'发射日历 / 小程序接口'};
  const states = {
    healthy:['运行正常',''], upstream_retrying:['上游暂未更新，正在重试','warn'], upstream_cooldown:['等待上游允许重试','warn'],
    refresh_stuck:['刷新卡住，准备恢复','error'], stale_without_progress:['缓存更新停滞','error'], api_unresponsive:['接口无响应','error'],
    snapshot_unreadable:['缓存暂时无法读取','error'], reader_behind_snapshot:['接口数据同步延迟','warn'],
    recovery_cooldown:['已尝试恢复，冷却等待中','warn'], recovery_limit_reached:['达到恢复次数限制，需要检查','error'],
    check_overdue:['未收到近期巡检结果','error'], unknown:['状态暂不可用','neutral']
  };
  const monitoring = {running:['巡检正常',''],stopped:['巡检已停止','error'],unknown:['巡检状态暂不可用','warn'],overdue:['巡检结果超时','error']};
  const date = n => n ? new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(n*1000)) : '暂无记录';
  const age = n => n == null ? '尚未取得成功更新记录' : n < 60 ? '不到 1 分钟前更新' : `${Math.floor(n/60)} 分钟前更新`;
  const el = (tag, text, cls) => {const n=document.createElement(tag); if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const badge = ([text,cls]) => el('span',text,`cache-badge ${cls}`);
  let latest, busy=false;
  function events() {
    const root=document.querySelector('#cache-events'); if(!root||!latest)return;
    root.replaceChildren();
    const only=document.querySelector('#recoveries-only').checked;
    const rows=latest.events.filter(e=>!only||e.action==='restart'||e.recovered);
    if(!rows.length){root.append(el('p',only?'暂无自动恢复记录':'暂无巡检变化记录','empty'));return;}
    for(const e of rows){
      const row=el('div',null,'cache-event');row.append(el('time',date(e.at)));
      const body=el('div');const service=names[e.service]||'发射数据服务';
      if(e.action==='restart'){
        const result={accepted:'重启已执行，等待巡检确认',failed:'重启失败',timed_out:'重启命令超时'}[e.result]||'已发起重启';
        body.append(el('strong',`${service} · ${result}`),el('p',`原因：${(states[e.reason]||states.unknown)[0]}`));
      }else body.append(el('strong',`${service} · ${e.recovered?'恢复正常':(states[e.status]||states.unknown)[0]}`));
      row.append(body);root.append(row);
    }
  }
  function render(d){
    latest=d;
    if(summary){
      const times=d.feeds.filter(f=>f.fetchedAt).map(f=>f.fetchedAt);
      summary.querySelector('p').textContent=`${monitoring[d.monitoring][0]} · ${d.feeds.some(f=>f.stale)?'缓存待更新':'缓存正常'} · 最近成功更新 ${date(times.length?Math.min(...times):null)}`;
    }
    if(!full)return;
    const cards=document.querySelector('#cache-cards');cards.replaceChildren();
    for(const f of d.feeds){const c=el('section',null,'cache-card');c.append(el('h3',f.name),badge(f.stale?['缓存待更新','warn']:['数据已更新','']),el('strong',date(f.fetchedAt),'cache-value'),el('p',`最后成功更新 · ${age(f.ageSeconds)}`),el('p',`最近尝试：${date(f.checkedAt)}`));if(f.retryAt>d.generatedAt)c.append(el('p',`下次允许重试：${date(f.retryAt)}`));cards.append(c);}
    const c=el('section',null,'cache-card');c.append(el('h3','自动巡检'),badge(monitoring[d.monitoring]),el('strong',date(d.lastCheck),'cache-value'),el('p','最后巡检 · 每两分钟检查一次'),el('p',`开机自动巡检：${d.timer.enabled==='enabled'?'已开启':d.timer.enabled==='disabled'?'未开启':'暂无法确认'}`));cards.append(c);
    const services=document.querySelector('#cache-services');services.replaceChildren();
    for(const s of d.services){const row=el('div',null,'cache-service');row.append(el('strong',s.name),badge(states[s.status]||states.unknown),el('small',`检查时间：${date(s.checkedAt)} · 近 6 小时恢复尝试 ${s.restartCount} 次`));services.append(row);}
    events();
  }
  async function load(){
    if(busy)return;busy=true;
    const btn=document.querySelector('#cache-refresh'),msg=document.querySelector('#cache-message');
    if(btn)btn.disabled=true;
    try{
      const r=await fetch('./api/cache-monitor',{cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!r.ok)throw Error(r.status===401||r.status===403?'登录已失效，请重新登录后台':'监控状态读取失败');
      const d=await r.json();render(d);
      if(msg){msg.className='';msg.textContent=`页面更新于 ${date(d.generatedAt)} · 每 30 秒自动刷新显示${d.available?'':' · 尚未读取到巡检记录'}`;}
    }catch(e){if(msg){msg.className='error';msg.textContent=`${e.message}，请稍后刷新。已有显示仅供参考。`;}if(summary)summary.querySelector('p').textContent='监控状态暂时无法读取，请进入缓存监控查看。';}
    finally{busy=false;if(btn)btn.disabled=false;}
  }
  document.querySelector('#cache-refresh')?.addEventListener('click',load);
  document.querySelector('#recoveries-only')?.addEventListener('change',events);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  load();setInterval(()=>{if(!document.hidden)load();},30000);
})();
