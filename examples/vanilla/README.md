# Calamus 原生 JavaScript 示例

不使用 React，也不需要 UI 组件库。`app.js` 从 SDK 公共入口创建画板，`index.html` 通过 import map 指向本地打包产物。

## 运行

在仓库根目录运行：

```sh
pnpm install --frozen-lockfile
pnpm example:vanilla
```

打开终端显示的本地地址。准备脚本会构建核心包、生成 tarball、在临时外部项目中离线安装并验证，再复制安装包的 `dist` 到本例的 `vendor`。此目录被 Git 忽略，重新准备时会被替换，不要手动编辑。

`pnpm example:prepare` 只准备文件；随后可使用任意静态 HTTP 服务托管本目录。不要通过 `file://` 打开。内置 Vite 开发配置和浏览器 import map 指向同一份已安装 tarball 的产物，不引用核心源码。示例使用仓库已有的 Vite 工具作为开发服务器，SDK 本身没有运行时依赖。

运行 `pnpm example:build` 可以构建独立静态页面，产物位于本目录的 `dist`。构建不代表完成浏览器交互验收。

## 手工检查

- 绘制笔画，切换颜色、粗细及 Adaptive smoothing / Radius follow / Raw input。
- 切换 Eraser 擦除整笔，Undo/Redo 恢复，Clear 后可撤销。
- 下载 PNG、SVG 和 JSON；PNG 含纸面底色，SVG/JSON 不含 CSS 纸面背景。
- 点击 Destroy instance，确认画布不再接收绘制；Create instance 恢复已完成笔画并重置历史。
- 调整窗口尺寸，检查画布与指针定位。

页面仅在内存保留销毁前的已完成笔画。刷新会丢失作品；未完成手势不会导出或恢复。异步导出期间暂时禁用销毁操作。错误显示在状态区域。

## 已验证范围

实际 tarball 的 ESM 消费、示例 JavaScript 的严格类型检查和静态构建已通过。浏览器绘制、下载、焦点及响应布局验收仍待补；目前不声称已完成这些检查。

## 经典 script / UMD 示例

执行 `pnpm example:prepare` 后，用静态 HTTP 服务托管此目录，打开 `/vendor/umd.html`。
例如 `python3 -m http.server 5174 --bind 127.0.0.1 --directory examples/vanilla`，访问 http://127.0.0.1:5174/vendor/umd.html 。

准备脚本从同一个已安装 tarball 复制 UMD 为 `calamus.umd.js`，保证常见静态服务器返回 JavaScript MIME；页面按顺序以 defer 加载 SDK 和示例，通过 `window.CalamusSDK` 使用公共 API，不需要模块加载器。页面和脚本由现有 ESM 示例生成，位于忽略的 vendor 目录；修改源示例后重新准备即可。`example:build` 仍只构建 ESM 页面。

2026-11-14 已在桌面应用内浏览器验证 UMD 加载、绘制一笔、销毁禁用控件、重建和 JSON 下载；下载文档经 SDK 校验，保留一笔。此结果不替代 PNG/SVG、真实触控设备及其他浏览器验收。
