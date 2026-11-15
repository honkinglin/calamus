# 原生 SDK 示例浏览器验收

日期：2026-11-14。环境：macOS 应用内浏览器，静态 HTTP 服务，实际 tarball 的 ESM 产物与 import map，无 React 或开发服务器模块转换。

- [x] 1280×720 视口加载原生示例，绘制一笔后 Undo 可用。
- [x] Undo 后 0 笔，Redo 后恢复 1 笔。
- [x] PNG、SVG、JSON 实际下载成功。
- [x] PNG 为 1000×700，所有 chunk CRC 与 IDAT 解压验证通过。
- [x] SVG 可解析，viewBox 为 0 0 1000 700，包含 1 条 path。
- [x] 销毁后绘图控件与导出禁用；重建后恢复控件，历史重置。
- [x] 切换至 390×844，控件换行，画布保留原笔迹，再绘制后显示 2 笔。
- [x] 重建并继续绘制后导出 JSON，SDK parseDocument 验证通过，首笔与销毁前逐字段一致。

## 复查方法

执行 pnpm example:prepare，再以静态 HTTP 服务托管 examples/vanilla；根页面为 ESM 示例，vendor/umd.html 为经典脚本示例。按上述顺序操作；此示例不会保存到本地存储，刷新会丢失作品。

## 边界

本轮验收未修改运行代码。390px 是桌面浏览器视口模拟，不代表真实触屏压力、Safari/Firefox 或移动系统验收。未验证橡皮、每种稳定模式、完整键盘流程、PNG/SVG 逐像素一致性及页面往返缓存。UMD 的已验证范围见示例 README。
