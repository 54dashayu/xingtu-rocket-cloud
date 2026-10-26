import { loadArchiveRecords } from './archive-evidence.js?v=0.02';
export function archivePeriod(time, now = Date.now()) {
  const age = now - Date.parse(time);
  return !Number.isFinite(age) || age < 0 ? 'future' : age <= 365 * 86400000 ? 'year' : 'older';
}

export async function mountObservationArchive(container, {onReplay} = {}) {
  container.textContent = '正在读取参考档案…';
  try {
    const records = await loadArchiveRecords();
    const node = (tag, text, className) => {
      const el = document.createElement(tag); el.textContent = text;
      if (className) el.className = className;
      return el;
    };
    container.replaceChildren(node('h2', '火箭云参考档案'));
    container.append(node('p', '首批整理七次火箭云观测案例。所列地区不代表整个省域都可见，相关来源可展开查看。', 'archive-intro'));
    const current = document.createElement('div'), older = document.createElement('details');
    older.append(node('summary', '更早的参考案例'));
    let count = 0;
    for (const record of [...records].sort((a,b) => Date.parse(b.time)-Date.parse(a.time))) {
      const period = archivePeriod(record.time);
      if (period === 'future') continue;
      const card = node('article', '', 'archive-source-card');
      card.append(node('h3', record.name));
      const format = zone => new Intl.DateTimeFormat('zh-CN', {timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).format(new Date(record.time));
      card.append(node('p', `${format('Asia/Shanghai')} 北京时间${record.timeZone === 'Asia/Shanghai' ? '' : ` · 当地 ${format(record.timeZone)}`}`, 'archive-source-time'));
      card.append(node('p', `观测描述：${record.transcriptClaim}${record.transcriptRegions.length ? `（${record.transcriptRegions.join('、')}）` : (record.transcriptClaim.includes('未提供观看地点') ? '' : '；未给出具体观看地区')}`));
      if (record.reportedRegions.length) card.append(node('p', `公开资料提及：${record.reportedRegions.join('、')}${record.observation?.association === 'highly_likely' ? '；原来源认为很可能与此次发射有关' : ''}`));
      const details = document.createElement('details');
      details.append(node('summary', `查看来源 · ${record.sources.length} 条`));
      for (const source of record.sources) {
        let url; try { url = new URL(source.url); } catch { continue; }
        if (url.protocol !== 'https:') continue;
        const link = node('a', source.title); link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';
        details.append(link);
      }
      for (const note of record.notes) details.append(node('p', note));
      details.append(node('p', '这些资料用于记录观测与核对任务，尚不包含完整的高度、时间和地面位置序列。'));
      card.append(details);
      if (period === 'year' && record.launchId && onReplay) {
        const replay = node('button', '回放模拟', 'archive-replay');
        replay.type = 'button';
        replay.onclick = async () => {replay.disabled=true;try{await onReplay(record.launchId);}finally{replay.disabled=false;}};
        card.append(replay);
      }
      if (period === 'year') {current.append(card);count++;} else older.append(card);
    }
    container.append(node('h3', `近一年 · ${count} 个参考案例`), current, older);
  } catch {
    container.textContent = '参考档案暂时未能加载，请刷新重试。报告填写不受影响。';
  }
}
