# 星途访问统计

给站点维护者使用的合并后台。发射日历 `/launch/` 与火箭云 `/rocket-cloud/` 共用一个统计页；可按产品、日期、IP 筛选，查看页面次数、会话、独立 IP、前台停留、来源域名和访问明细。不是用户人数或实际注意力测量。

## 部署与认证

Python 3.10+，IP 地区查询使用仓库内附的 ip2region 读取器，无需 pip 安装。`server.py` 仅监听 `127.0.0.1:8792`。部署在 `/opt/xingtu-analytics/current`，数据库 `/var/lib/xingtu-analytics/visits.sqlite3`，服务见 `xingtu-analytics.service`。持久目录由 www-data 拥有、权限 0700，数据文件 0600。不要把数据库和日志提交到仓库。

`nginx-space.inc` 加入 space 域名 TLS server，另在 http 上下文加入：

```nginx
limit_req_zone $binary_remote_addr zone=xingtu_events:10m rate=5r/s;
```

`/xingtu-admin/` 与它的全部子路径由原有 `BH1JSS Operations` Basic auth 保护，复用服务器已有 htpasswd。公开收集端点不能读取统计。后端的 `X-Xingtu-Admin` 仅由受认证 Nginx location 设置；不能将服务端口暴露到外网。可将 `nginx-app.inc` 加到统一管理域名，实现同域名登录体验，转发既有 Authorization 到同一所有者的 HTTPS 上游。

两个产品 HTML 在结束前引入：

```html
<script defer src="/xingtu-analytics/tracker.js"></script>
```

保留 `/xingtu-analytics/privacy` 的统计说明链接。公开仓库只包含代码，不包含账号、口令、访问 IP 或采集数据。

## 统计口径

- 每次文档打开一个随机 page ID，心跳幂等更新；刷新计一次，地图内切换任务不新增 PV。
- 同源 sessionStorage 保存临时会话，打开页面时距上次活跃不足30分钟沿用；不使用持久 cookie、指纹或第三方追踪。
- 可见状态累计时间；15秒心跳、隐藏/离开时 sendBeacon。bfcache 恢复不把暂停时间算进停留。
- 后端取累计最大值，容忍重试/乱序，按服务器经过时间限制上报增量；最长单页6小时。
- IP 来自 Nginx 覆写的 X-Real-IP，不信任用户提交的 IP 或 X-Forwarded-For。IP 变化时保留首次 IP。独立 IP 不代表人数。
- 尊重 Do Not Track；记录为尽力采集，浏览器拦截、崩溃和断网可能漏报；已识别爬虫排除，不能保证完全过滤机器人。
- 不采集表单/任务参数或来源路径查询，只采集来源域名、浏览器和设备大类。
- 每小时清理90天前明细；日期范围按北京时间，单页明细30条。
- 对部署前最后30天 Nginx 日志独立导入，仅 GET 页面200/304；资源/API/跳转不算。历史记录不混入新采集 PV，无停留数据。重复导入按原始日志行哈希去重（同一秒完全相同的真实重复请求也可能合并）。

导入时用实际启用前端采集的 Unix 时间作为截止值：

```sh
ANALYTICS_DB=/var/lib/xingtu-analytics/visits.sqlite3 python3 server.py --import-logs /path/access.log* --before UNIX_TIMESTAMP
```

日志可能包含用户可识别信息，须在服务器本机处理。备份 SQLite 用 SQLite backup API；备份应同样私有、90天后删除。回滚可以恢复前一个目录软链接和 Nginx 配置，保留独立数据库。服务停用时前端上报失败不会阻塞产品。

## 验证

```sh
python3 -m unittest discover -s analytics/tests -v
node --test analytics/tests/tracker.test.cjs
```

上线还需检查：未登录后台 HTML/API 均401；公开路径不能绕过认证；两个产品真实浏览器上报成功；隐藏页面期间停留不增长；重启后数据仍在；管理首页入口可用。上线后的维护者验收访问也会计入统计。

## IP 大致地区

排行和明细均在读取时补充地区，支持历史记录和 IPv4 / IPv6。使用本地 ip2region xdb，访客 IP 不发送到外部 API。只缓存两份向量索引（约 1 MiB），文件读取加锁避免并发 seek 错位，结果缓存最多 8192 个 IP。数据库缺失时显示“暂未识别”，不阻塞统计。

部署时下载固定版本并校验 SHA-256（约 48 MB，数据不进入 Git）：

```sh
python3 analytics/fetch_geoip.py /opt/xingtu-analytics/shared/geoip
```

可用环境变量 `ANALYTICS_GEOIP_DIR` 指定其他目录。数据保持 root 所有、目录 0755 / 文件 0644，服务仅读取。更换数据后重启统计服务清除缓存。固定来源版本、许可证见 `vendor/README.md`；数据更新不定期，不将安装日期当成归属记录日期。地区是 IP 网络出口的大致归属，可能与实际位置不同；历史访问使用当前库解析，不能还原当时 IP 归属。不进行反向 DNS 或第三方查询。

## 用户观测报告（V0.02）

“报告 / 档案”为独立页面，无需选择发射任务。时间与地点可自由描述；当前时间按北京时间填写，当前地点只在点击后请求浏览器定位，提交前不发送坐标。报告及坐标不公开，保留一年；图片上传暂未启用。

`/report` 保存原始描述。可识别的日期、小时、晨昏时段按北京时间生成时间区间，搜索区间前90分钟至后10分钟的已发射任务；这只是宽松候选检索，不是可见性判定。有 WGS84 坐标时按距发射场距离排序，不把发射场距离当作尾迹距离。文字地址、无法解析的时间、其他坐标系以及数据源失败均保留原文待作者核对，不伪造坐标或匹配结论。

`/report-summary` 仅公开候选任务的汇总条数，不公开报告时间、地点、原文或编号。关联候选可进入历史参考模拟，继续优先采用有来源的轨迹；没有来源时使用可调整的参考航向，不自动升级“已证实火箭云”。后台标为无效后，不再计入解锁条件。仅有模糊报告、未匹配到任何任务时不会凭空创建发射任务。
