// Shared additions to the calendar/API's Chinese name rules. Preserve unknown names.
export function chineseMissionLabel(value = '') {
  return value.replace(/\bSmart Dragon[ -]*3\b/gi, '捷龙三号')
    .replace(/\bJielong[ -]*3\b/gi, '捷龙三号')
    .replace(/\bSatNet test satellites?\b/gi, '卫星互联网技术试验卫星');
}
