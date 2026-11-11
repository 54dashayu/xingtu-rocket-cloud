# 服务器缓存监控后台

新增统一后台的“缓存监控”标签，首页显示简短摘要。最后成功更新时间、检查时间均以北京时间显示；未来 / 历史数据分开展示。服务异常、上游等待、重启冷却和超过恢复次数限制采用不同文案。恢复日志区分“命令已执行”与后续巡检确认的“恢复正常”，默认只看恢复记录，也可查看状态变化。

无新增公开管理接口；原有统一后台 Basic auth 继续保护新页面和 API。后台只读巡检结果，操作按钮只刷新显示，不能重启服务。图片、报告、访问统计数据库不变。

## 验证与部署

- Python 后台测试39项通过；独立巡检测试9项通过；JS语法检查通过。
- 本地合成数据验证有恢复记录的显示；通过 SSH 本机转发检查生产后台真实页面的桌面 / 手机布局、刷新、日志筛选及首页入口。实际生产记录目前无自动重启，未写入演示日志。
- app / space 两域名后台页面及 API 未认证返回401，公开 analytics 路径返回404。
- 部署目录：`/opt/xingtu-analytics/releases/cache-monitor-20261111`。
- 巡检目录：`/opt/xingtu-launch-watchdog/releases/0024-admin1`。
- 保持网页版本和构建号不变，无 App 或小程序提交。

## 回退

部署前路径及 service 文件保存于 `/var/backups/xingtu-cache-monitor-20261111`。恢复 analytics 和 watchdog 两个 current 软链、旧巡检 service 文件，执行 daemon-reload 并重启 analytics、启动巡检 timer。保留现有数据与状态记录。
