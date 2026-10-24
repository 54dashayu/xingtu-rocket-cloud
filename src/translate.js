const AGENCIES = new Map([
  ['SpaceX', '太空探索技术公司'], ['Rocket Lab', '火箭实验室'],
  ['Indian Space Research Organization', '印度空间研究组织'], ['Russian Federal Space Agency (ROSCOSMOS)', '俄罗斯国家航天集团'],
  ['China Aerospace Science and Technology Corporation', '中国航天科技集团'], ['China National Space Administration', '中国国家航天局'],
  ['China Manned Space Agency', '中国载人航天工程办公室'], ['European Space Agency', '欧洲航天局'],
  ['United Launch Alliance', '美国联合发射联盟'], ['Arianespace', '阿丽亚娜空间公司'], ['Avio S.p.A', '阿维奥航天公司'],
  ['Isar Aerospace', '伊萨尔航天公司'], ['Galactic Energy', '星河动力'], ['LandSpace', '蓝箭航天'],
  ['Orienspace Technology', '东方空间'], ['CAS Space', '中科宇航'], ['ExPace', '航天科工火箭技术有限公司'],
  ['Russian Space Forces', '俄罗斯空天军'], ['Korea Aerospace Research Institute', '韩国航空宇宙研究院'],
  ['Mitsubishi Heavy Industries', '三菱重工业'], ['HyImpulse', '海冲量航天公司'], ['Japan Aerospace Exploration Agency', '日本宇宙航空研究开发机构']
]);
const PRECISION = new Map([['Second', '精确到秒'], ['Minute', '精确到分钟'], ['Hour', '精确到小时'], ['Day', '仅确定日期'], ['Month', '仅确定月份'], ['Quarter', '仅确定季度'], ['Year', '仅确定年份']]);
const COUNTRIES = new Map([['CN', '中国'], ['US', '美国'], ['RU', '俄罗斯'], ['JP', '日本'], ['IN', '印度'], ['NZ', '新西兰'], ['NO', '挪威'], ['KZ', '哈萨克斯坦'], ['GF', '法属圭亚那'], ['SE', '瑞典'], ['KR', '韩国'], ['KP', '朝鲜'], ['FR', '法国'], ['DE', '德国'], ['IT', '意大利'], ['GB', '英国'], ['AU', '澳大利亚'], ['CA', '加拿大']]);
const hasChinese = (value) => /[\u3400-\u9fff]/.test(value || '');
export const translateAgency = (name) => {
  const translated = AGENCIES.get(name) || name || '未知机构';
  return !hasChinese(translated) && /[A-Za-z]/.test(translated) ? '机构中文名称待核验' : translated;
};
export const translatePrecision = (value) => PRECISION.get(value) || value || '未知';
export const translateCountry = (code, fallback) => COUNTRIES.get(code) || fallback || '未知国家或地区';

export function translateRocket(name = '') {
  // 火箭名称优先采用中文航天新闻和企业公告中的常用称谓；型号细节保留在原始字段中供检索。
  const translated = name.replace(/^Ceres-1S\b/i, '谷神星一号海射型').replace(/^Ceres-1\b/i, '谷神星一号').replace(/^Kinetica\s*-?\s*1\b/i, '力箭一号').replace(/^KSLV-2\s+Nuri\b/i, '世界号').replace(/^Nuri\b/i, '世界号').replace(/^SR75\b/i, 'SR75试验火箭').replace(/^Gravity-1\b/i, '引力一号').replace(/^Zhuque-3\b/i, '朱雀三号').replace(/^Zhuque-2E(?:\s+Block\s*2)?\b/i, '朱雀二号E型')
    .replace(/^Zhuque-2\b/i, '朱雀二号').replace(/^Long March\s*/i, '长征').replace(/^Falcon 9(?: Block 5)?/i, (match) => match.includes('Block') ? '猎鹰9号 Block 5型' : '猎鹰9号')
    .replace(/^Falcon Heavy/i, '猎鹰重型').replace(/^Electron\b/i, '电子号').replace(/^Soyuz\s*/i, '联盟')
    .replace(/\/?Fregat(?:-M)?\b/gi, (match) => match.startsWith('/') ? '／弗雷加特' : '弗雷加特')
    .replace(/^Vega-C\b/i, '织女星-C').replace(/^Vega\b/i, '织女星').replace(/^Ariane\s*/i, '阿丽亚娜').replace(/^Kuaizhou\s*/i, '快舟').replace(/^Starship\b/i, '星舰')
    .replace(/^Vulcan\b/i, '火神').replace(/^New Glenn\b/i, '新格伦').replace(/^H3\b/i, 'H3运载火箭')
    .replace(/^GSLV Mk\. II\b/i, '印度地球同步轨道运载火箭 Mk II').replace(/^PSLV\b/i, '印度极轨卫星运载火箭')
    .replace(/^Spectrum\b/i, '光谱号').replace(/^Pallas-1\b/i, '智神星一号').replace(/^Themis Demonstrator\b/i, '忒弥斯可重复使用验证火箭');
  return translated || '未知火箭';
}
// Translate the Yaogan series without changing satellite/group identifiers.
function yaoganSeries(value) {
  const n=Number(value), digits='零一二三四五六七八九';
  if(n<10)return digits[n];
  if(n<100)return (n<20?'':digits[Math.floor(n/10)])+'十'+(n%10?digits[n%10]:'');
  return value;
}
function translateYaogan(value) {
  return value.replace(/\bYaogan[\s-]*(\d+)(?:\s+Group\s+(\d+)|[-\s]+(\d+)(?:\s+to\s+(\d+))?(?:\s*\/\s*(\d+)-(\d+)(?:\s+to\s+(\d+))?)?)?/gi,
    (_,series,group,first,last,series2,first2,last2)=>{
      const satellite=(s,a,b)=>'遥感'+yaoganSeries(s)+'号'+(a?a+'星'+(b?'至'+b+'星':''):'');
      if(group)return '遥感'+yaoganSeries(series)+'号'+group+'组卫星';
      return satellite(series,first,last)+(series2?'、'+satellite(series2,first2,last2):'');
    }).replace(/\bYaogan\b/gi,'遥感');
}
export function translateMissionName(name = '', launchId = '') {
  // 国家航天局 2026-10-14 公告；按任务 ID 限定，不能把所有“10 satellites”都改成同一批载荷。
  // https://www.cnsa.gov.cn/n6758823/n6758838/c10780180/content.html
  if (launchId === 'dfcabb3c-078b-4f5b-a47c-0161f248cee9') {
    const payload = '国星宇航星时代-39、44至50星及光传-03、04星';
    return /[|｜]/.test(name) ? '朱雀二号改进型｜' + payload : payload;
  }
  // 新华社 2026-10-21：谷神星一号海射型、西光肆号01星。
  // https://finance.people.com.cn/n1/2026/1021/c1004-40818960.html
  const translated = name.replace(/Ceres-1S\b/gi, '谷神星一号海射型').replace(/Ceres-1\b/gi, '谷神星一号')
    .replace(/Xiguang-4\s+01\b/gi, '西光肆号01星')
    .replace(/Yaogan 40 Group\s+04\b/gi, '遥感四十号04组卫星')
    .replace(/SpaceSail Polar Group\s*#?16\b/gi, '千帆极轨26组卫星及欧洲高通量技术试验卫星')
    .replace(/SpaceSail Polar Group\s*#?15\b/gi, '千帆极轨15组卫星')
    .replace(/SpaceSail Polar Group\s*#?(\d+)\b/gi, '千帆极轨$1组卫星')
    .replace(/SatNet LEO Group\s*(\d+)\b/gi, '卫星互联网低轨$1组卫星')
    .replace(/PIESAT-2\s*(\d+)\s*(?:to|-)\s*(\d+)\b/gi, '宏图二号$1至$2星')
    .replace(/SpaceTY-(\d+)\s*&\s*(\d+)\b/gi, '天仪$1、$2星')
    .replace(/Kinetica\s*-?\s*1\b/gi, '力箭一号').replace(/SR75\b/gi, 'SR75试验火箭').replace(/H3-(\d+)\b/gi, 'H3运载火箭$1号').replace(/9 satellites\b/gi, '一箭九星')
    .replace(/Owlright,?\s*Owlright,?\s*Owlright/gi, '猫头鹰三连发').replace(/Owl By The Dozen/gi, '猫头鹰成组发射').replace(/Happily Ever Faster/gi, '更快向前').replace(/NeonSat-(\d+)\s+to\s+(\d+)\b/gi, '新一代中型卫星$1至$2号').replace(/Martian Moon eXplorer\s*\(MMX\)/gi, '火星卫星探测器').replace(/USSF-(\d+)\b/gi, '美国太空军$1任务').replace(/Yaogan 53-01 to 03\/56-01 to 03/gi, '遥感五十三号01星至03星、遥感五十六号01星至03星').replace(/Nancy Grace Roman Space Telescope/gi, '罗曼空间望远镜').replace(/Honghu[-\s]?0?3\b/gi, '鸿鹄03').replace(/Glonass-K1 No\.\s*(\d+)\b/gi, '格洛纳斯-K1 第$1号').replace(/Kosmos\s*(\d+)\b/gi, '宇宙$1号').replace(/Satellite for Earth Observation\s*\(SEO\)/gi, '对地观测卫星').replace(/Gravity-1\b/gi, '引力一号').replace(/Kinetica\s*-?\s*1\b/gi, '力箭一号').replace(/Nuri\b/gi, '世界号').replace(/Zhuque-3\b/gi, '朱雀三号').replace(/Zhuque-2E(?:\s+Block\s*2)?\b/gi, '朱雀二号E型').replace(/Zhuque-2\b/gi, '朱雀二号').replace(/Falcon Heavy\b/gi, '猎鹰重型').replace(/Falcon 9(?: Block 5)?/gi, '猎鹰9号').replace(/Long March\s*/gi, '长征').replace(/Electron\b/gi, '电子号').replace(/Soyuz\s*/gi, '联盟').replace(/\/?Fregat(?:-M)?\b/gi, (match) => match.startsWith('/') ? '／弗雷加特' : '弗雷加特').replace(/Vega-C\b/gi, '织女星-C').replace(/Ariane\s*/gi, '阿丽亚娜').replace(/Kuaizhou\s*/gi, '快舟').replace(/Vulcan\b/gi, '火神').replace(/Starship\b/gi, '星舰').replace(/Themis Demonstrator\b/gi, '忒弥斯验证器').replace(/GSLV Mk II/gi, '印度地球同步轨道运载火箭').replace(/Spectrum\b/gi, '光谱号').replace(/Pallas-1\b/gi, '智神星一号').replace(/Starlink Group\s*([\d-]+)/gi, '星链 $1 组')
    .replace(/O3b mPower\s*(\d+)-(\d+)\b/gi, '中地球轨道高通量通信卫星$1至$2号').replace(/MTG-I2\b/gi, '第二代气象卫星成像型2号')
    .replace(/Unknown Payload/gi, '未知载荷').replace(/Demo Flight/gi, '验证飞行').replace(/7 satellites\b/gi, '一箭七星').replace(/Crew-(\d+)/gi, '载人-$1 任务')
    .replace(/Progress MS-([\d]+)/gi, '进步 MS-$1 货运飞船').replace(/Flight\s*(\d+)/gi, '第 $1 次飞行')
    .replace(/Owl Around The World/gi, '环游世界').replace(/StriX Launch\s*(\d+)/gi, 'StriX 第 $1 次发射')
    .replace(/Onward and Upward/gi, '向上、向前').replace(/BlackSky Gen-3/gi, '黑天第三代').replace(/Amazon Leo/gi, '亚马逊利奥')
    .replace(/GISAT-1A/gi, '地球静止轨道成像卫星 GISAT-1A').replace(/Sentinel-3C/gi, '哨兵-3C').replace(/FLEX\b/gi, '荧光探测卫星 FLEX')
    .replace(/SDA Tranche 1 Transport Layer A/gi, '太空发展局第1批运输层卫星').replace(/6x HawkEye 360/gi, '6 颗鹰眼360卫星')
    .replace(/\s+\|\s+/g, '｜').replace(/\(([^)]+)\)/g, '（$1）');
  // 尚无可靠中文译名时保留原文，不能用核验状态遮蔽任务名称。
  return translateYaogan(translated);
}

export function translateDescription(value, missionName = '') {
  if (!value) return '任务详情待发布。';
  const name = missionName.toLowerCase();
  if (name.includes('starlink')) return '发射一批星链低轨互联网卫星。';
  if (name.includes('owl around')) return '为日本地球观测公司 Synspective 发射一颗合成孔径雷达卫星。';
  if (name.includes('gisat')) return 'GISAT-1A 是印度地球静止轨道观测卫星，用于持续观测印度次大陆并快速监测自然灾害。';
  if (name.includes('onward and upward')) return '伊萨尔航天“光谱号”火箭第二次试飞，将携带 5 颗立方星和 1 项不分离实验。';
  if (name.includes('progress')) return '为国际空间站执行的进步货运飞船补给任务。';
  if (name.includes('unknown payload')) return '载荷与任务详情待公开。';
  if (name.includes('sentinel-3c')) return '哨兵-3C 将提供海洋与陆地观测数据；FLEX 卫星将测量植物荧光，研究光合作用活动。';
  if (name.includes('blacksky')) return '发射黑天第三代地球成像卫星。';
  if (name.includes('starship')) return '星舰两级运载系统第 14 次试飞，也是星舰 V3 的第 3 次飞行。';
  if (name.includes('sda tranche')) return '为美国太空发展局的低轨通信网络发射 21 颗卫星。';
  if (name.includes('long march 12a')) return '长征十二号甲运载火箭第二次试验发射，载荷信息待公开。';
  if (name.includes('amazon leo')) return '为亚马逊利奥低轨宽带互联网星座发射 45 颗卫星。';
  if (name.includes('o3b mpower')) return '发射 3 颗由波音制造、SES 运营的中地球轨道高通量通信卫星。';
  if (name.includes('hawkeye')) return '发射鹰眼 360 射频遥感卫星，用于交通监测、应急支持与射频信号分析。';
  if (name.includes('loxsat')) return 'LOXSAT 1 将在轨验证低温液氧储存和转移技术。';
  if (name.includes('themis')) return '忒弥斯验证器首次低空跳跃试验，目标高度最高约 100 米。';
  if (name.includes('crew-13')) return 'SpaceX 载人-13 是 NASA 商业载人计划中飞往国际空间站的载人龙飞船任务。';
  return '暂无经核验的中文任务说明，请通过下方来源页面核对详情。';
}
export function translateLocation(value = '') {
  if (!value) return null;
  const rules = [[/Jiuquan.*China/i, '中国酒泉卫星发射中心'], [/Wenchang.*China/i, '中国文昌航天发射场'], [/Xichang.*China/i, '中国西昌卫星发射中心'], [/Taiyuan.*China/i, '中国太原卫星发射中心'],
    [/Cape Canaveral.*USA/i, '美国佛罗里达州卡纳维拉尔角'], [/Kennedy Space Center.*USA/i, '美国肯尼迪航天中心'], [/Vandenberg.*USA/i, '美国范登堡太空军基地'], [/Baikonur Cosmodrome.*$/i, '哈萨克斯坦拜科努尔航天发射场'],
    [/Kourou|Guiana Space Centre|French Guiana/i, '法属圭亚那库鲁航天中心'], [/Satish Dhawan Space Centre.*$/i, '印度萨蒂什·达万航天中心'], [/Mahia.*New Zealand/i, '新西兰马希亚发射场'], [/Tanegashima Space Center.*$/i, '日本种子岛宇宙中心'],
    [/Haiyang Oriental Spaceport/i, '山东海阳东方航天港'], [/Plesetsk Cosmodrome.*$/i, '俄罗斯普列谢茨克发射场'], [/Andøya Spaceport/i, '挪威安岛航天港'],
    [/SpaceX Starbase.*USA/i, '美国得克萨斯州星舰基地'], [/SaxaVord Spaceport/i, '英国萨克萨沃德航天港'], [/Naro Space Center.*South Korea/i, '韩国罗老宇宙中心']];
  const translated = rules.find(([pattern]) => pattern.test(value))?.[1] || value;
  return !hasChinese(translated) && /[A-Za-z]/.test(translated) ? '发射场中文名称待核验' : translated;
}
