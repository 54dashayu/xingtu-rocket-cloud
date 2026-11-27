# Android 测试容器（0036）

versionName `0.03` / versionCode `36`，包名 `net.bh1jss.xingtu.dev`。APK 内置 `public/` 页面，API、地图和报告服务仍需联网；共享 Web 更新不会自动替换已安装 APK 内的脚本。

本次 Release 分发已有 debug 签名测试包，未发布 Google Play。0036 包含单文档更新、有限缓存补取、手动刷新去重/状态保留及天气地名修复。自行编译使用自己的签名，可能无法直接覆盖发行附件。

```sh
npm ci
npm run snapshot
npm run sync
npm run build:android
```

需要 Node.js、JDK21 与 Android SDK。`snapshot` 从本仓库 `public/` 生成 `www/`，并应用报告数量适配；生成资源、SDK路径、凭据、APK不入源码树。`scripts/report-summary-adapter.test.mjs` 可独立离线测试。

原生壳保持 HTTPS 校验、权限与外链处理。单次打开不周期刷新不意味着停止服务器采集；App 前台生命周期不强制重载页面。定位、报告和照片操作由用户主动发起。
