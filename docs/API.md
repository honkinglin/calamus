# SDK API

本文对应当前 ESM 包入口 `@calamus/core`。独立 UMD 可通过 `@calamus/core/umd` 获取（全局命名空间 `CalamusSDK`），类型消费仍使用根 ESM 入口。内部模块未通过 exports 暴露，不能作为稳定接口使用。包尚未发布，安装方式见[包说明](../packages/core/README.md)。

## 创建与配置

`new Calamus(canvas: HTMLCanvasElement, options?: CalamusOptions)` 创建浏览器引擎。Canvas 需已挂载且 CSS 尺寸非零，逻辑坐标与 CSS/设备像素相互独立。

| 配置 | 默认值 / 行为 |
| --- | --- |
| `width`, `height` | 逻辑尺寸 `1000 × 700`，1–32,768 的有限数；导入文件必须尺寸一致 |
| `brush` | `Partial<Brush>`，覆盖下列默认笔刷 |
| `onStroke(stroke)` | 用户完成画笔手势后调用，参数为独立副本；擦除和程序导入不调用 |
| `onChange(state)` | 已提交文档/历史变化后调用，不是每个输入点的通知 |
| `onReplayChange(state)` | 回放状态为 `idle`、`playing` 或 `paused` |

`Brush` 字段：

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `color: string` | `#253631` | 仅接受 3/4/6/8 位十六进制色，确保 JSON 可回读 |
| `size: number` | `6` | 逻辑像素宽度基准，范围 0.01–4,096 |
| `smoothing?: number` | `0.55` | 0–1，自适应平滑强度，0 关闭 |
| `stabilizer?: number` | `0` | 0–4,096 有限数，半径跟随的最大半径；起笔渐进生效 |
| `velocityWidth?: boolean` | `true` | 无硬件压力时使用速度调节宽度 |

`setBrush(partial)` 影响后续笔画；当前笔画在起笔时已保存笔刷快照。实时配置与文件导入共用笔刷校验。非法设置在修改前抛错，保留已有笔刷；实例销毁后 setBrush 也会抛错。完整约束见[文档格式](DOCUMENT_FORMAT.md)。

## 绘制与历史

| API | 行为 |
| --- | --- |
| `setTool('pen' \| 'eraser')` | 切换工具并取消当前手势；橡皮整笔删除，非局部像素擦除 |
| `state` | 返回 `{ strokes, undo, redo }` 三个数量 |
| `getStrokes()` | 返回所有已提交笔画的深拷贝 |
| `setStrokes(strokes)` | 先校验并复制，再替换文档；产生可撤销历史并清空 redo |
| `clear()` | 取消手势/回放，非空文档清空可撤销 |
| `undo()`, `redo()` | 切换历史，取消当前手势/回放；无对应历史时不改变文档 |
| `destroy()` | 移除监听和观察器、停止回放、取消手势、释放活动及已提交栅格缓存；重复调用无副作用，不要再复用该实例 |

销毁时若正在回放，清理完成后才通知 `onReplayChange('idle')`；调用方回调抛错仍向外传播，但不会中断资源清理。销毁不清空调用方可见画布，也不清空已提交笔画的内存快照；需要释放实例对象时应移除应用对它的引用。

输入保护：零尺寸或无效边界的 Canvas 不接受起笔；手势中遇到非法坐标、压力或超出文档范围的采样会取消整次手势，橡皮临时移除也会恢复，不产生历史。事件时间倒退时沿用上一采样时间，保持笔内时间单调。恢复有效尺寸后可重新起笔。

笔画提交、导入及历史变更是持久化的合适时机。SDK 不包含持久化适配器，历史目前未设容量上限。

## 回放

- `play({ speed?: number })`：从头播放，速度默认 1，允许 0.25–4；回放期间不接受新笔画。
- `pauseReplay()`、`resumeReplay()`：暂停/恢复，不修改已提交文档和历史。
- `stopReplay()`：回到完整文档显示。

回放使用每笔相对时间；并不恢复原始两笔之间的真实停顿。

## 导入与导出

| API | 返回值及选项 |
| --- | --- |
| `exportJSON()` | 版本 1 文档字符串，原始采样与逻辑尺寸，不含主题、纸色、历史、当前手势 |
| `loadJSON(json, { resetHistory?: boolean })` | 先校验尺寸和内容；默认作为可撤销替换，`true` 清空 undo/redo |
| `exportSVG({ crop?, padding? })` | 矢量字符串，透明背景，使用处理后填充几何 |
| `exportPNG({ crop?, padding?, scale?, background? })` | `Promise<Blob>`；默认透明背景，指定 background 后填底色 |

`crop` 默认关闭；开启后按笔迹几何范围裁切，可能超出原逻辑画布。`padding` 默认 12，范围 0–4096；空文档返回完整画布。PNG `scale` 默认 1，范围 `(0, 4]`，单边最多 16,384 像素、总像素最多 32,000,000，超限抛错；编码失败 Promise 拒绝。PNG 导出也可能同步抛错，使用 `try { await ... } catch` 统一处理。

导出始终来自完整已提交文档，而非屏幕回放进度。JSON 导入失败不会替换已有文档。

## 纯函数与类型

- `processStroke(stroke): RenderPoint[]`：从原始点派生平滑坐标与 `width`，不修改原始点。
- `createStrokeGeometry(stroke): Vertex[][]`：生成圆点与连接段多边形。
- `createSVG(strokes, width, height, cropOptions?)`：无 DOM 矢量导出。
- `parseDocument(json): CalamusDocument`：校验并返回规范化数据，剔除未知字段。
- `drawStroke(context, stroke)`：向调用方 Canvas 2D 上下文绘制，使用当前变换；会修改当前路径和 fillStyle，不负责 clear/save/restore。
- `PAPER`：默认逻辑尺寸。

入口同时导出 `Point`、`Brush`、`Stroke`、`RenderPoint`、`Vertex`、`CalamusOptions`、`HistoryState`、`ReplayState`、`PNGExportOptions`、`CropOptions` 和 `CalamusDocument` 类型。除 `parseDocument` 外的纯绘制/几何函数假定输入已有效；处理外部数据应先校验。
