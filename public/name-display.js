// 网页显示层词典；通用描述直接翻译，专有名称参考译法单独标记。
// 不改变 API 原文、计划状态或小程序显示。
const descriptiveRules = [
  [/Bandwagon\s+(\d+)/gi, '拼车任务 $1'],
  [/Dedicated Mid-Inclination Rideshare/gi, '中倾角轨道专用拼车发射'],
  [/Martian Moons eXploration/gi, '火星卫星探测任务'],
  [/Dedicated Rideshare/gi, '专用拼车发射'],
  [/Rideshare/gi, '拼车发射'],
  [/\b(\d+)x\s+/gi, '$1 颗 '],
  [/\bLaunch\s+(\d+)/gi, '第 $1 次发射'],
  [/\bFlight\s+(\d+)/gi, '第 $1 次飞行'],
  [/\bothers\b/gi, '其他载荷'],
  [/\bSSLV\b/g, '小型卫星运载火箭（SSLV）']
];
const referenceRules = [
  [/We're Not Hawking Around/gi, '鹰眼行动'],
  [/The Sea God Surveys/gi, '海神巡测'],
  [/The Mountain God Rises/gi, '山神升起'],
  [/HawkEye 360/gi, '鹰眼360']
];
export function displayName(value = '') {
  let text = value;
  for (const [pattern, replacement] of descriptiveRules) text = text.replace(pattern, replacement);
  let provisional = false;
  for (const [pattern, replacement] of referenceRules) {
    text = text.replace(pattern, () => { provisional = true; return replacement; });
  }
  return { text, provisional };
}
