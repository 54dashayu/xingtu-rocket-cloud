# 星途访问统计

给站点维护者使用的合并后台。发射日历 `/launch/` 与火箭云 `/rocket-cloud/` 共用一个统计页；可按产品、日期、IP 筛选，查看页面次数、会话、独立 IP、前台停留、来源域名和访问明细。不是用户人数或实际注意力测量。

## 部署与认证

Python 3.10+ 标准库，无第三方依赖。`server.py` 仅监听 `127.0.0.1:8792`。部署在 `/opt/xingtu-analytics/current`，数据库 `/var/lib/xingtu-analytics/visits.sqlite3`，服务见 `xingtu-analytics.service`。持久目录由 www-data 拥有、权限 0700，数据文件 0600。不要把数据库和日志提交到仓库。

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
