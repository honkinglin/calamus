# Calamus

现代 Canvas 在线画板与零运行时依赖的 TypeScript 绘图 SDK。

[English](README.md) · [API 说明](docs/API.md) · [数据格式](docs/DOCUMENT_FORMAT.md) · [架构说明](docs/ARCHITECTURE.md) · [开发计划](docs/DEVELOPMENT_PLAN.md)

## 当前能力

- 自适应平滑、半径跟随、触控笔压力与速度宽度计算。
- 整笔擦除、撤销重做、可暂停/调速的笔画回放。
- PNG、SVG、JSON 导出；图像导出支持内容裁切与留白。
- React 画板：本地多作品管理、可恢复删除、缩放平移、主题、参数实验区。
- 原生 TypeScript 核心，当前输出 ESM 与声明文件，提供独立原生 JS 示例。

项目处于开发阶段。包名尚未最终确认，`private: true` 阻止误发布；尚未发布 npm 或部署公开网站。CommonJS/UMD、Worker 填充尚未实现，发布身份和许可证选择仍待确认。

## 本地启动

需要 Node.js ≥22.12、pnpm 10.15.1。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开终端显示的地址。运行 `pnpm example:vanilla` 查看不依赖 React 的 SDK 接入示例：其产物来自实际 tarball 安装，不直接引用核心源码。详见[示例运行说明](examples/vanilla/README.md)。

## 接入与验证

按[包说明](packages/core/README.md)安装本地 tarball，在具有非零 CSS 尺寸的 Canvas 上创建 `Calamus`，通过公开 API 绑定工具和导出操作，组件卸载时调用 `destroy()`。SDK 本身不保存或上传作品。

```sh
pnpm test
pnpm build
pnpm check:package
pnpm example:build
```

包消费检查包含仓库外离线安装、无 DOM 的 ESM 导入、NodeNext/Bundler 类型消费和原生 JS 示例严格检查。它们不能替代真实浏览器交互及像素验收。

## 已知边界

透明高密度路径仍可能卡顿；近期渲染优化的浏览器回归、真实触屏/触控笔和跨浏览器验收尚未完成。作品保存在当前浏览器，本地多标签冲突合并及云同步未实现；建议导出 JSON 备份。未完成手势不会进入导出文件。

[开发进度](docs/PROGRESS.md)区分实现完成与验收完成；[性能报告](docs/PERFORMANCE.md)保留测量条件，不将 Node 计算耗时当作浏览器帧率。

[Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [Release checklist](docs/RELEASE_CHECKLIST.md)
