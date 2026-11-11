# v0.03 build 0024 — 缓存自动巡检与恢复

2026-11-11。火箭云、发射日历与小程序继续使用同一个服务器发射数据快照；本次新增服务器守护，无需更新移动客户端。

## 自动处理规则

- 独立 systemd timer 每两分钟运行，不依赖网页 Node 进程的定时器；开机自动启用。
- 分别检查未来与历史数据，成功更新超过 45 分钟记为陈旧。
- 陈旧数据超过 20 分钟没有检查进展、且不在上游要求的等待期内，判为刷新停滞。
- 刷新持续至少 5 分钟且快照版本没有推进，判为刷新卡住。
- 同时检查火箭云及发射日历的本机 API；无响应或持续落后于共享快照也会进入恢复判断。
- 连续两次巡检异常才重启对应服务。每个服务至少间隔 30 分钟，每 6 小时最多尝试 3 次，失败的重启也计入限额。
- 遇到限流和上游故障，沿用 build 0023 的持久化请求配额、超时及退避；有重试进展时不会仅因数据陈旧而重启。重启不删除数据或配额文件。
- systemctl 成功仅记为重启已接受；后续巡检重新检查服务、快照和缓存时间。不能保证上游中断时仍能取得最新数据。

## 运行与诊断

脚本：`deploy/launch-watchdog.py`。服务配置：同目录 `xingtu-launch-watchdog.service`、`.timer`。

服务器安装路径：`/opt/xingtu-launch-watchdog/current/launch-watchdog.py`。
状态与最近 100 条状态变化/恢复记录：`/var/lib/xingtu-launch-watchdog/status.json`，仅服务器管理员可读。

```sh
systemctl status xingtu-launch-watchdog.timer
journalctl -u xingtu-launch-watchdog.service --since today
cat /var/lib/xingtu-launch-watchdog/status.json
python3 /opt/xingtu-launch-watchdog/current/launch-watchdog.py --dry-run
```

`--dry-run` 不重启服务、不写入状态记录。探测使用本机现有 API，不强制刷新，不直接请求上游。

## 验证

`python3 -m unittest discover -s test -p launch_watchdog_test.py`：9 项通过。覆盖陈旧数据、单个数据分区停滞、卡死与正常进展、API 无响应、读取方版本落后、上游退避、重启限额、状态持久化和恢复后的检查。故障恢复使用模拟时钟和替身 systemctl 验证，未故意中断生产服务。

部署后首次真实巡检：两个服务均 healthy，快照 revision 403，无异常重启。公网两个数据入口返回相同 revision / fetchedAt。定时器已启用；页面构建号 0024。

## 回退

先停用巡检：`systemctl disable --now xingtu-launch-watchdog.timer`。
网页上一版本：`/opt/rocket-cloud/releases/v0.03-0023-20261111`；恢复 current 软链并重启 rocket-cloud。无需回退共享数据、配额文件或发射日历服务。本次未修改日历业务代码。
