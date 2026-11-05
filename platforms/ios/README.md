> build 6 已修复 iPadOS 27 启动闪退：迁移至 UIScene / UIWindowScene 生命周期。

# V0.03 更新（2026-11-05）

MARKETING_VERSION 0.03，build 6。在线 WKWebView 载入同一套五导航/3D 页面；已移除早期报告提交拦截，使用持久化网站存储，增加定位用途说明与浅色原生外观，补充 1024 AppIcon。报告仅在用户主动提交时发送。

本轮用户已授权继续打包；以下旧记录中的“只读验证壳”“不要归档”仅描述此前准备阶段，不再作为本轮构建限制。日历原生导出仍未开放，真机定位和报告提交未实测。构建与签名结果见 ../../output/v0.03/RELEASE.md。

# 星途 iOS P01 · 本地开发准备

2026-11-03。仅本目录由 iOS 对话维护，Android 对话不得修改。共享 public/、src/、analytics/、根 package.json 均未调整；没有部署、签名配置、商店建档或审核提交。

## 当前产物

- `Xingtu.xcodeproj`：UIKit + WKWebView 原生验证工程，无第三方包。临时 Bundle ID `net.bh1jss.xingtu.ios.dev`，本地版本 0.1.0 (1)，最低部署目标暂定 iOS 16，支持 iPhone/iPad。
- `App/`：启动直达整合页面、系统分享、安全区域容器、外链处理、失败提示。沿用 public/icons/rocket-cloud-512.png，不是正式 1024 AppIcon。
- 预览使用临时 WebKit 存储，关闭后不承诺保留状态。启动直接加载线上整合页面；“首页”也返回整合页面，不再经过欢迎中转页。
- 内容规则阻止 `/xingtu-analytics/` 请求，包括报告提交和统计。此为只读验证壳，不是首版完整 App。定位、事件编辑、ICS/blob 下载、离线业务和正式图标尚未实现。

## 本地构建

```sh
./scripts/build-simulator.sh
open Xingtu.xcodeproj
```

命令在本目录运行。构建产物 `output/DerivedData/Build/Products/Debug-iphonesimulator/Xingtu.app`。脚本仅为当前进程设置 DEVELOPER_DIR，不切换系统 xcode-select。

真机前：在 Xcode 选定用户的 Developer Team，确认正式 Bundle ID，再连接 iPhone、启用开发者模式并运行。当前仅有模拟器包，不能安装到真机；不要使用 `-allowProvisioningUpdates` 自动建标识或申请资料，也不要归档上传。

详见 [方案与验收](docs/首版方案与验收.md)。整个目录移走即可撤销本轮源码准备；不会改变网站。

## 后续模拟器交互测试

见 [2026-11-03 模拟器测试](docs/2026-11-03-模拟器测试.md)。已修复整合入口误跳 Safari 和日历导出误报成功；地图/图表共享播放进度、历史筛选和分享弹窗已实测。横屏地图区域偏小仍待优化。
