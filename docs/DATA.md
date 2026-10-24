# 数据、接口与可复现性

## 数据源

| 用途 | 当前来源 | 边界 |
|---|---|---|
| 发射计划／历史 | [The Space Devs Launch Library 2](https://thespacedevs.com/llapi) | 社区维护聚合数据；时刻精度与状态必须保留，不等于全量官方任务遥测 |
| 天气 | [Open-Meteo](https://open-meteo.com/) | 预报或模式再分析，不是每个地点现场实测；远期、缺测和失败均明确表示 |
| 航向候选约束 | [notam-whisper](https://github.com/lzq1206/notam-whisper) 的 NOTAM／MSI 公共 CSV | 第三方聚合，不是本项目直接接入官方 NOTAM 服务；原文、有效时段和区域仍需核对 |
| 海岸线 | [Natural Earth](https://www.naturalearthdata.com/) | 低分辨率本地矢量底图，无国界展示 |
| 观测证据 | `rocket-cloud-evidence.json` 中带链接记录 | 独立于几何／天气结论，新闻证据只用于左侧卡片标记 |

公开仓库不附带生产发射缓存、访问日志、账号信息和部署密钥。数据服务可能有限额、延迟或不可用，部署者需按服务条款使用；程序不保证永久免费或永久可达。

## 航警约束的具体规则

`src/navigation-warnings.js` 独立实现 CSV 解析、时间筛选和方位计算，没有复制 notam-whisper 的程序代码。当前每 30 分钟缓存其 `notams.csv` / `msi.csv`。源数据不是本仓库自有数据，也不随源码打包再授权。

当前只接受包含火箭／航天活动语义、有限且不超过 12 小时的有效窗口、任务时刻落在窗口内的多边形区域；排除明显取消、回收、再入以及无法解析的 NOTAM D) 日程。区域顶点距场址需在 80–2500 km，指向区域的最小方位弧宽不超过 45°；与已有方向明显冲突的区域不推荐。角度跨越 0°时按圆周区间处理。

这仍然只是时段与场址几何匹配，**没有自动完成任务 ID、国别、载荷、通告用途或多任务冲突的权威消歧**。落区方向和初始起飞航向可能不同，通告多边形不代表上升轨迹。前端展开候选后，由用户点击“用作模拟约束”，把其中心方向作为模拟值，并约束手动角度在该区间内；“恢复建议”解除约束。不自动修改已公布发射时间、新闻证据或历史航向。不同候选不自动求交，以免把不相关落区拼成假航路。

宽窗口、轮换日期、缺少区域或当前没有匹配通告时保留原先推演，不伪造更精确方向。实时 feed 也不代表完整历史档案。历史任务当前不使用这条实时通告路径。

## HTTP API

路径均相对于部署前缀，线上前缀为 `/rocket-cloud/`。

| 路径 | 结果 |
|---|---|
| `GET api/launches?days=30` | 近期任务 |
| `GET api/launches/previous?days=30` | 历史任务 |
| `GET api/launches/{id}/cloud-assessment?range=upcoming&target=150` | 模型与天气评估 |
| `GET api/launches/{id}/heading-constraints?range=upcoming` | 航警候选方位区间 |
| `GET api/calendar/subscription.ics?since=YYYY-MM-DD` | 固定起点持续日历订阅 |

模型接口支持 `target=100|150`、成对 `latitude` / `longitude`、未来模拟用 `simulationTime=ISO-UTC-Z` 与 `azimuth`。航警接口支持未来 `simulationTime`；历史手动时间被拒绝。请求参数不接受任意上游 URL。

## 飞行采样接口

`data/flight-profiles.json` 为任务级注册表。每条采样要求 `launchId`、与任务相同的 `net`、`frame: WGS84-geodetic`、`kind: planned|measured|reconstructed`、`publishedAt`、HTTPS `sourceUrl` 和时间单调的 `points`（秒、高度 km、地面距离 km、经纬度）。

可附 `propulsion`：单独来源、发布时间、有序不重叠的 `burns` 和 `finalCutoff`；末次关车必须落在采样范围内，高度与插值结果一致。验证通过后，历史任务可按公开关车点截止；否则仍使用当前分析截点。不能凭一个轨道高度或 TLE 反推出完整上升段。

## 运行配置

`HOST` / `PORT` 默认 `127.0.0.1:4173`；`CACHE_TTL_MS` 默认 30 分钟；`LAUNCH_LIBRARY_PAGES` 默认 3。可配置上游 `LAUNCH_LIBRARY_URL` / `LAUNCH_LIBRARY_PREVIOUS_URL` 与 `CACHE_FILE` / `HISTORY_CACHE_FILE` / `CALENDAR_ARCHIVE_FILE`。

生产缓存应放在版本目录外，不随部署清空。当前归档面向单进程；部署多个实例时必须规划统一数据获取与共享存储，避免重复请求上游限额。更换域名前缀时反向代理需剥离前缀转发，保留页面相对 URL。示例见 `deploy/README.md`。
