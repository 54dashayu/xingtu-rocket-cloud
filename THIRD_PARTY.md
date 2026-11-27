# 第三方资料与服务

- Natural Earth：本地 `public/map/land.json` 海岸线数据，公共领域，见 https://www.naturalearthdata.com/about/terms-of-use/ 。
- The Space Devs Launch Library 2：运行时任务数据，服务与数据按其条款使用，https://thespacedevs.com/llapi 。生产响应缓存未包含在公开仓库。
- Open-Meteo：天气 API 数据，按其数据归属及 API 使用条件使用，https://open-meteo.com/en/terms 。本项目代码许可证不代替 API 商业／非商业使用条件。
- notam-whisper：NOTAM／MSI 外部聚合 feed，https://github.com/lzq1206/notam-whisper 。其程序采用 GPL-3.0，本项目没有复制其代码或分发其 CSV 快照；独立适配器运行时读取数据并标注聚合来源，原始通告及聚合数据不因本仓库 MIT 许可而重新授权。
- USNO / NOAA：太阳位置与近似公式参考，https://aa.usno.navy.mil/faq/sun_approx 、https://gml.noaa.gov/grad/solcalc/solareqns.PDF 。
- `data/` 的补充记录与历史案例内保留各条公开参考链接；新闻原文、照片、视频版权属于各自权利人，除下方明确列出的授权/公共领域图片外，不分发新闻正文、视频或用户投稿。

本项目标志为独立制作的示意设计，不代表航天机构授权或背书。

## 当前静态资源补充

- Three.js：固定版本本地资源位于 `public/3d/vendor/`，保留其 MIT LICENSE。
- 天地图：底图及接口由部署者自行配置授权，不能随本项目 MIT 许可转授权访问凭据。
- 卫星百科：本地库仅整理有来源的型号事实字段和链接，不分发百科全文；官方型号资料优先。
- 档案照片：仓库包含少量带原始来源及使用范围的历史任务图片，见 `public/map/media/README.md`。
- Noto Sans CJK 字体：用于公开照片署名，许可证位于 `analytics/fonts/OFL.txt`。
