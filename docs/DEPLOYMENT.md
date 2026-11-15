# Vercel 部署

- 正式网站：https://calamus-five.vercel.app/
- 源码仓库：https://github.com/honkinglin/calamus
- Vercel 团队：Kyrie Lin's projects
- 项目：calamus
- 生产分支：main
- 首次部署源码：5b809605a90f600205404b88499f2d246425e6ca
- 首次部署状态：READY

## 项目设置

| 设置 | 值 |
| --- | --- |
| Framework | Vite |
| Root Directory | 仓库根目录 |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm build` |
| Output Directory | `apps/web/dist` |
| Node.js | 24.x |

从仓库根目录构建，确保先生成 workspace 核心 SDK，再构建 Web。无需服务器环境变量；作品存储在访问者浏览器，不会同步到 Vercel。新的生产域名与 localhost 使用不同的浏览器存储，需要导出/导入 JSON 转移本地作品。

项目已关联 GitHub 仓库。后续更新推送到 main 后应检查 Vercel 的新构建结果；不要将本地 commit 当作线上已更新的证据。本次部署没有发布 npm 包。

## 验证记录

2026-11-14：生产域名无认证请求返回 200；浏览器页面加载、画布绘制、保存提示、刷新恢复及 JSON 下载通过，导出数据经 SDK 校验有效。本地测试 81 项通过。

保留现有访问保护设置；生产域名已能访问，无需关闭保护。没有配置运行时日志收集或客户端错误监控；该网站为静态前端，函数日志不能替代浏览器错误验收。
