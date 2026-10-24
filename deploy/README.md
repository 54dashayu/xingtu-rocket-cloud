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
