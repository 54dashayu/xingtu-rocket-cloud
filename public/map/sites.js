// Permanent educational site registry. Coordinates represent facilities, not actual trajectories.
// LL2 source fields checked against the local public-data snapshot fetched 2026-10-24.
export const MAJOR_SITES = [
  {
    "id": "jiuquan",
    "name": "酒泉卫星发射中心",
    "short": "酒泉",
    "region": "中国 · 内蒙古",
    "aliases": [
      "Jiuquan",
      "酒泉",
      "酒泉卫星发射中心"
    ],
    "latitude": 40.892,
    "longitude": 100.217,
    "timezone": "Asia/Shanghai",
    "description": "中国内陆航天发射场。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/dc570565-4dcf-4ab9-8174-bf88efef477f/"
  },
  {
    "id": "taiyuan",
    "name": "太原卫星发射中心",
    "short": "太原",
    "region": "中国 · 山西",
    "aliases": [
      "Taiyuan",
      "太原",
      "太原卫星发射中心"
    ],
    "latitude": 38.85,
    "longitude": 111.61,
    "timezone": "Asia/Shanghai",
    "description": "中国内陆航天发射场。",
    "coordinateSource": "既有内置场区代表点",
    "source": "https://www.cnsa.gov.cn/n6758823/n6758844/n6760209/n6760215/c6809195/content.html"
  },
  {
    "id": "xichang",
    "name": "西昌卫星发射中心",
    "short": "西昌",
    "region": "中国 · 四川",
    "aliases": [
      "Xichang",
      "西昌",
      "西昌卫星发射中心"
    ],
    "latitude": 28.25,
    "longitude": 102.03,
    "timezone": "Asia/Shanghai",
    "description": "中国内陆航天发射场。",
    "coordinateSource": "既有内置场区代表点",
    "source": "https://www.cnsa.gov.cn/n6758823/n6758844/n6760209/n6760215/c6809195/content.html"
  },
  {
    "id": "wenchang",
    "name": "文昌航天发射场",
    "short": "文昌",
    "region": "中国 · 海南",
    "aliases": [
      "Wenchang",
      "文昌",
      "文昌航天发射场"
    ],
    "latitude": 19.597,
    "longitude": 110.931,
    "timezone": "Asia/Shanghai",
    "description": "海南沿海发射场；含数据源所列文昌商业发射台。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/6b95bcc8-1f88-4539-84fe-f63630138766/"
  },
  {
    "id": "florida",
    "name": "肯尼迪 / 卡纳维拉尔角",
    "short": "佛罗里达",
    "region": "美国 · 佛罗里达",
    "aliases": [
      "Cape Canaveral",
      "佛罗里达",
      "肯尼迪 / 卡纳维拉尔角",
      "Kennedy",
      "肯尼迪",
      "卡纳维拉尔"
    ],
    "latitude": 28.583,
    "longitude": -80.583,
    "timezone": "America/New_York",
    "description": "两个相邻航天发射场合并为区域标记；任务中保留具体发射台。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/ef9850ad-1096-425b-9d27-f7bbd186e61a/"
  },
  {
    "id": "vandenberg",
    "name": "范登堡太空军基地",
    "short": "范登堡",
    "region": "美国 · 加利福尼亚",
    "aliases": [
      "Vandenberg",
      "范登堡",
      "范登堡太空军基地"
    ],
    "latitude": 34.632,
    "longitude": -120.611,
    "timezone": "America/Los_Angeles",
    "description": "美国西海岸发射场。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/e2886a96-5ce9-4f45-872f-4e25a00be837/"
  },
  {
    "id": "wallops",
    "name": "瓦洛普斯飞行中心",
    "short": "瓦洛普斯",
    "region": "美国 · 弗吉尼亚",
    "aliases": [
      "Wallops",
      "瓦洛普斯",
      "瓦洛普斯飞行中心"
    ],
    "latitude": 37.833,
    "longitude": -75.488,
    "timezone": "America/New_York",
    "description": "NASA 多用户航天发射场。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/71489c66-8ecd-4610-9847-3620a543fd75/"
  },
  {
    "id": "starbase",
    "name": "星舰基地 Starbase",
    "short": "星舰基地",
    "region": "美国 · 得克萨斯",
    "aliases": [
      "Starbase",
      "星舰基地",
      "星舰基地 Starbase",
      "Boca Chica"
    ],
    "latitude": 25.997,
    "longitude": -97.158,
    "timezone": "America/Chicago",
    "description": "位于美国得克萨斯州海岸的航天发射基地。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/0f867f0c-5422-4d44-93b8-d7faaae7019b/"
  },
  {
    "id": "kourou",
    "name": "圭亚那航天中心",
    "short": "库鲁",
    "region": "法属圭亚那 · 库鲁",
    "aliases": [
      "Guiana",
      "库鲁",
      "圭亚那航天中心",
      "Kourou"
    ],
    "latitude": 5.256,
    "longitude": -52.787,
    "timezone": "America/Cayenne",
    "description": "位于赤道附近的欧洲航天发射场。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/7bdc412b-c965-4517-a131-f57a01189803/"
  },
  {
    "id": "mahia",
    "name": "火箭实验室一号发射场",
    "short": "马希亚",
    "region": "新西兰 · 马希亚半岛",
    "aliases": [
      "Mahia",
      "马希亚",
      "火箭实验室一号发射场",
      "Rocket Lab Launch Complex 1"
    ],
    "latitude": -39.261,
    "longitude": 177.866,
    "timezone": "Pacific/Auckland",
    "description": "位于新西兰北岛马希亚半岛。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/426bd2a5-02dd-4fbd-9f4d-2b8439c3a1ff/"
  },
  {
    "id": "baikonur",
    "name": "拜科努尔航天发射场",
    "short": "拜科努尔",
    "region": "哈萨克斯坦",
    "aliases": [
      "Baikonur",
      "拜科努尔",
      "拜科努尔航天发射场"
    ],
    "latitude": 45.996,
    "longitude": 63.564,
    "timezone": "Asia/Qyzylorda",
    "description": "位于哈萨克斯坦的航天发射场。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/8dd5de11-831b-445f-86f0-bffefe0550d9/"
  },
  {
    "id": "plesetsk",
    "name": "普列谢茨克航天发射场",
    "short": "普列谢茨克",
    "region": "俄罗斯 · 阿尔汉格尔斯克州",
    "aliases": [
      "Plesetsk",
      "普列谢茨克",
      "普列谢茨克航天发射场"
    ],
    "latitude": 62.93,
    "longitude": 40.58,
    "timezone": "Europe/Moscow",
    "description": "俄罗斯北部内陆发射场。",
    "coordinateSource": "既有内置场区代表点",
    "source": null
  },
  {
    "id": "vostochny",
    "name": "东方航天发射场",
    "short": "东方发射场",
    "region": "俄罗斯 · 阿穆尔州",
    "aliases": [
      "Vostochny",
      "东方发射场",
      "东方航天发射场"
    ],
    "latitude": 51.884,
    "longitude": 128.334,
    "timezone": "Asia/Yakutsk",
    "description": "位于俄罗斯远东地区。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/bff2fc91-eddd-4dfc-af26-ac0674cfab4d/"
  },
  {
    "id": "tanegashima",
    "name": "种子岛宇宙中心",
    "short": "种子岛",
    "region": "日本 · 鹿儿岛",
    "aliases": [
      "Tanegashima",
      "种子岛",
      "种子岛宇宙中心"
    ],
    "latitude": 30.401,
    "longitude": 130.976,
    "timezone": "Asia/Tokyo",
    "description": "位于日本种子岛的航天发射场。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/ac02da00-6e8b-45a0-b829-09d614891e6a/"
  },
  {
    "id": "uchinoura",
    "name": "内之浦宇宙空间观测所",
    "short": "内之浦",
    "region": "日本 · 鹿儿岛",
    "aliases": [
      "Uchinoura",
      "内之浦",
      "内之浦宇宙空间观测所"
    ],
    "latitude": 31.251,
    "longitude": 131.082,
    "timezone": "Asia/Tokyo",
    "description": "位于日本九州南部。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/cb0c27fd-496c-4f74-aa04-9c0e5af33e3c/"
  },
  {
    "id": "hokkaido",
    "name": "北海道航天港",
    "short": "北海道",
    "region": "日本 · 北海道",
    "aliases": [
      "Hokkaido",
      "北海道",
      "北海道航天港"
    ],
    "latitude": 42.5,
    "longitude": 143.441,
    "timezone": "Asia/Tokyo",
    "description": "数据源收录的日本北部航天港。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/4f68b074-f52c-4d79-95c5-353a247b773e/"
  },
  {
    "id": "sriharikota",
    "name": "萨蒂什·达万航天中心",
    "short": "斯里赫里戈达",
    "region": "印度 · 安得拉邦",
    "aliases": [
      "Satish Dhawan",
      "斯里赫里戈达",
      "萨蒂什·达万航天中心"
    ],
    "latitude": 13.72,
    "longitude": 80.23,
    "timezone": "Asia/Kolkata",
    "description": "位于斯里赫里戈达岛的印度航天发射中心。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/20d5676e-111b-40e3-8923-b218c3665ca2/"
  },
  {
    "id": "naro",
    "name": "罗老宇宙中心",
    "short": "罗老",
    "region": "韩国 · 高兴",
    "aliases": [
      "Naro",
      "罗老",
      "罗老宇宙中心"
    ],
    "latitude": 34.432,
    "longitude": 127.535,
    "timezone": "Asia/Seoul",
    "description": "位于韩国南部沿海。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/628749e8-b535-4483-9a3b-9a93b1b0c6d1/"
  },
  {
    "id": "andoya",
    "name": "安岛航天港",
    "short": "安岛",
    "region": "挪威 · 安岛",
    "aliases": [
      "Andøya",
      "安岛",
      "安岛航天港"
    ],
    "latitude": 69.108,
    "longitude": 15.589,
    "timezone": "Europe/Oslo",
    "description": "北极圈内的沿海航天港。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/b48e32c5-3776-4684-a956-5ea4df032e90/"
  },
  {
    "id": "saxavord",
    "name": "萨克萨沃德航天港",
    "short": "萨克萨沃德",
    "region": "英国 · 设得兰群岛",
    "aliases": [
      "SaxaVord",
      "萨克萨沃德",
      "萨克萨沃德航天港"
    ],
    "latitude": 60.819,
    "longitude": -0.774,
    "timezone": "Europe/London",
    "description": "位于英国北部设得兰群岛。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/91b13c6c-4525-496d-997b-3521bb6a4cd8/"
  },
  {
    "id": "esrange",
    "name": "埃斯兰奇航天中心",
    "short": "埃斯兰奇",
    "region": "瑞典 · 基律纳",
    "aliases": [
      "Esrange",
      "埃斯兰奇",
      "埃斯兰奇航天中心"
    ],
    "latitude": 67.877,
    "longitude": 21.165,
    "timezone": "Europe/Stockholm",
    "description": "北极圈内的航天中心。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/3b94ad50-3505-496e-8a95-b0bc4c0dadc6/"
  },
  {
    "id": "bowen",
    "name": "鲍恩轨道航天港",
    "short": "鲍恩",
    "region": "澳大利亚 · 昆士兰",
    "aliases": [
      "Bowen",
      "鲍恩",
      "鲍恩轨道航天港"
    ],
    "latitude": -19.958,
    "longitude": 148.113,
    "timezone": "Australia/Brisbane",
    "description": "位于澳大利亚东北海岸。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/304b8810-9c89-47ee-a21a-05559fcf14af/"
  },
  {
    "id": "alcantara",
    "name": "阿尔坎塔拉航天中心",
    "short": "阿尔坎塔拉",
    "region": "巴西 · 马拉尼昂",
    "aliases": [
      "Alcântara",
      "阿尔坎塔拉",
      "阿尔坎塔拉航天中心"
    ],
    "latitude": -2.317,
    "longitude": -44.369,
    "timezone": "America/Fortaleza",
    "description": "位于南纬约 2 度的沿海发射场。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/7c891a0b-7194-4425-8cfd-2e8c75af2924/"
  },
  {
    "id": "etlaq",
    "name": "埃特拉克航天港",
    "short": "埃特拉克",
    "region": "阿曼 · 杜库姆",
    "aliases": [
      "Etlaq",
      "埃特拉克",
      "埃特拉克航天港"
    ],
    "latitude": 18.786,
    "longitude": 56.822,
    "timezone": "Asia/Muscat",
    "description": "数据源收录的阿曼沿海航天港。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/ed2bf159-ee2d-4b60-bb8e-e964c005c8d9/"
  },
  {
    "id": "haiyang",
    "name": "海阳东方航天港",
    "short": "海阳",
    "region": "中国 · 山东",
    "aliases": [
      "Haiyang",
      "海阳",
      "海阳东方航天港"
    ],
    "latitude": 36.664,
    "longitude": 121.188,
    "timezone": "Asia/Shanghai",
    "description": "岸基保障位置；海上实际发射点随任务变化，另按公开任务坐标标记。",
    "coordinateSource": "公开 LL2 发射台附近代表点",
    "source": "https://ll.thespacedevs.com/2.3.0/launches/a8d8d683-3ab0-40ab-beb0-e66bb55afd91/"
  }
];

export function findSite(pad={}) {
  pad ||= {};
  const name = `${pad.originalLocation || ""} ${pad.location || ""} ${pad.name || ""}`.toLowerCase();
  if (/sea launch|海上发射|海射/.test(name) && !/haiyang|海阳/.test(name)) return null;
  return MAJOR_SITES.find(s=>s.aliases.some(a=>name.includes(a.toLowerCase()))) || null;
}
