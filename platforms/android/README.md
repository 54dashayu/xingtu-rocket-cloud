# 当前构建：v0.03 / 0030（2026-11-12）

航警时间标注清晨/傍晚，观测分析自动填入模拟参考时刻。小米15已覆盖安装；图表播放、地图切换连续播放、3D播放暂停与时间拖动均已真机验证，见 [0030记录](docs/2026-11-12-0030时间与演示.md)。

# 历史构建：v0.03 / 0029（2026-11-12）

已内置共享网页0029的航警任务观测分析、地图回放与3D支持。小米15已覆盖安装，保留数据；动态验证记录见 [0029航警演示](docs/2026-11-12-0029航警演示.md)。开发测试包，未发布应用商店。以下为历史记录。

# 当前构建：v0.03 / 0022（2026-11-10）

未来30天与历史均支持国别、载人/非载人、国营/私营分类筛选。Android模拟器12组实际页面筛选比对及412px竖屏验证通过。小米15未连接，本次尚未真机安装。APK位于output/v0.03-0022，记录见docs/2026-11-10-0022分类筛选.md。以下为历史记录。

# 当前版本：v0.03 / 0021（2026-11-07）

对齐网页0020后，修复Android 3D页遗漏公共用户报告计数造成的参考回放失败。已安装小米15并完成历史按钮44px、USSF-432隐藏入口、谷神星二号参考3D生成验证。详情见docs/2026-11-07-0020对齐.md末尾补测。仅开发包，未发布商店。

# 当前版本：v0.03 / 0020（2026-11-07）

已对齐共享网页构建0020并安装至小米15。应用标识和开发签名保持不变，versionCode20。五导航、内置网页、报告授权与数据来源说明已同步；未发布应用市场。详细验证与局限见 [0020对齐记录](docs/2026-11-07-0020对齐.md)。

以下均为历史记录，其中旧网络故障及旧功能状态不能代表当前版本。

# V0.03 更新（2026-11-05）

用户可见版本 0.03，versionCode 4；沿用原应用标识及调试签名，可覆盖已有开发版。已内置五导航、3D 页面及统一蓝白配色，补充点击定位后的系统权限申请。APK 为开发测试包，未发布应用市场。详见 ../../output/v0.03/RELEASE.md。

以下为早期记录，版本与功能以本次说明为准。

# 星途 Android

当前版本 0.1.1-online / versionCode 2。打开即显示网页版的四个导航入口：地图演示、发射日历、观测分析、报告 / 档案。已替换原先的开发说明占位页。

所有本平台文件均在 platforms/android，未编辑共享网页、后端或 iOS 工程。

## 当前实现

MainActivity 使用原生 WebView + WebViewAssetLoader，APK 内置当前公开网页资源。页面以现有 HTTPS 来源运行，读取现有 API，保留四入口及共用播放状态。没有给网页暴露 JavaScript 原生桥。启动界面不依赖远程 HTML 下载；实际任务、天地图、天气和报告服务仍需联网。

GET /rocket-cloud/api/ 通过原生 HTTPS 读取，保留证书校验、状态码与超时；外部链接交给系统浏览器。系统返回先关闭弹层，再从其他导航页回到地图，随后返回桌面；切页不会清空报告表单。已处理系统栏和键盘安全区。

当前真机四导航显示/切换通过，服务连接超时仍待解决。定位授权、ICS 下载/导入和原生分享尚未接入；不要将网页按钮显示视为原生能力验收。未实际提交观测报告。

## 构建

```sh
npm ci
npm run snapshot
npm run sync
npm run build:android
```

snapshot 从 ../../public 复制公开资源至 snapshot/public 和 www，以 map.html 作为 App index.html，并移除网页访问统计脚本。它不复制密钥或后台文件。逐文件 SHA-256 在 snapshot/manifest.json。build:android 使用本机已有 Homebrew JDK 21，不改全局 Java。

APK：android/app/build/outputs/apk/debug/app-debug.apk。

## 安装

```sh
export ANDROID_HOME="$HOME/Library/Android/sdk"
"$ANDROID_HOME/platform-tools/adb" devices -l
"$ANDROID_HOME/platform-tools/adb" -s DEVICE_SERIAL install -r android/app/build/outputs/apk/debug/app-debug.apk
"$ANDROID_HOME/platform-tools/adb" -s DEVICE_SERIAL shell am start -W -n net.bh1jss.xingtu.dev/.MainActivity
```

## 网页开发预览

npm run preview 在 http://127.0.0.1:4186 预览只读快照；它拒绝报告提交。这个开发服务器不参与 APK 运行。

[本次四导航接入结果](docs/四导航接入-2026-11-03.md)
