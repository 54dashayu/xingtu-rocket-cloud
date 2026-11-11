# 星途 iOS

当前本地版本：0.03 / build 16（2026-11-07）。在线 WKWebView 直接载入 https://space.bh1jss.net/rocket-cloud/ ，当前在线网页 v0.03 / 0031 已在模拟器加载，显示完整动力段与 T+780 秒时间轴；未重新打包，未进行此次 iPhone 真机验收。仅维护本目录。

## 当前行为

- 启动直达整合页面，沿用网页导航、任务与报告/照片授权逻辑；没有欢迎中转页或顶部原生菜单。
- 采用 UIScene 生命周期、持久化网站存储、原生安全区域与底部 CSS 适配；保留 GeometryOnly 标记及前后台事件。
- 报告/照片由用户主动提交，已移除早期只读原型拦截。公开署名图片由后端返回，iOS 不重复加水印。
- 加载时提供原生状态提示，20秒未完成显示重新加载按钮；导航失败或 WebKit 页面进程退出也提供重试。
- 日历原生导出仍未开放，点击导出有明确未完成提示。
- 页脚保留网页版本，同时附加 iOS 版本及构建号，避免混淆两个版本层。
- 已有 AppIcon、相机/图库/定位用途说明和本地化；真机权限与真实报告链路需单独验收。

## 构建

在本目录运行 `./scripts/build-simulator.sh`；使用完整 Xcode，脚本不更改系统 xcode-select。
模拟器产物：`output/DerivedData/Build/Products/Debug-iphonesimulator/Xingtu.app`。
工程：`Xingtu.xcodeproj`，Bundle ID `net.bh1jss.xingtu.ios.dev`。

本轮未归档上传、未提交 App Store、未安装真机。历史签名包和设备记录不代表 build 16 已验收。

[本轮对齐记录](docs/2026-11-07-web-0020-alignment.md)；[早期模拟器记录](docs/2026-11-03-模拟器测试.md)。早期只读壳、欢迎页、分享气泡说明均为历史状态。

[历史报告候选3D修复验收](docs/2026-11-07-history-3d-0021.md)：线上共享修复，无原生二进制变更。
