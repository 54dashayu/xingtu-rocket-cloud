# Web 部署

安装 Node.js 20+，以非特权用户运行 `node src/server.js`。运行时无需 npm 依赖。

将缓存置于版本目录之外的可写目录，例如：

```sh
HOST=127.0.0.1 PORT=4179 \
CACHE_FILE=/srv/rocket-cloud/shared/cache.json \
HISTORY_CACHE_FILE=/srv/rocket-cloud/shared/history-cache.json \
CALENDAR_ARCHIVE_FILE=/srv/rocket-cloud/shared/calendar-archive.json \
node src/server.js
```

先创建 shared 目录并设置运行用户权限。反向代理示例（已有 HTTPS 站点的 server 段内）：

```nginx
location = /rocket-cloud { return 301 /rocket-cloud/; }
location ^~ /rocket-cloud/ {
    proxy_pass http://127.0.0.1:4179/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

尾部斜杠使代理剥离前缀；页面资源与 API 使用相对 URL。部署应保留旧版本及独立缓存，先检查配置再切换目录并重启进程。验证首页、图标、历史/未来接口与 ICS 返回类型；失败则切回旧目录。

部署到自己的域名时，修改页脚的运营者、首页链接与备案信息，不要沿用本项目站点的身份信息。外部数据服务按其条款申请适当额度，不要通过多实例重复请求规避限额。

## 天地图

设置服务器环境变量 `TIANDITU_TOKEN` 为你自己的天地图浏览器端 Key。通过 `/api/map-config` 提供给浏览器，以 HTTPS 直接调用官方 `vec_c` 与 `cva_c` WMTS；浏览器 Key 会出现在地图请求中，请在天地图控制台管理授权域名与额度，不要填入服务端私密凭据。部署环境配置不提交到仓库。未配置时仍显示原有简化底图。

经纬度瓦片与现有 lon+180 / 90-lat 图层对齐；服务的一级瓦片矩阵是两列一行。中文地名自第4级开始启用，具体省名、城市层级由天地图注记提供，不自行重绘行政界线。原有轨迹、太阳与观测区域算法不变。

底图审图号核对：2026-10-25，天地图官网 https://www.tianditu.gov.cn/ 与传统版在线地图 https://map.tianditu.gov.cn/2020/ 均显示 GS（2026）4921号。此处是底图标注，不代表本应用取得独立地图审核批准；后续应随官方服务更新核对。
