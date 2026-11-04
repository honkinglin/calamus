import { iterateGeometry } from './geometry.js';
import { StrokeProcessor } from './stroke.js';
import type { Vertex } from './geometry.js';
import type { Stroke } from './index.js';
import type { RenderPoint } from './stroke.js';

/** Opaque source-over strokes may be filled in bounded batches without alpha accumulation. */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  drawGeometry(ctx, stroke.brush.color, iterateGeometry(processPoints(stroke)));
}

export function drawProcessedStroke(ctx: CanvasRenderingContext2D, color: string, points: readonly RenderPoint[]): void {
  drawGeometry(ctx, color, iterateGeometry(points));
}

export function drawGeometry(ctx: CanvasRenderingContext2D, color: string, polygons: Iterable<readonly Vertex[]>): void {
  const batchSize = canBatchOpaque(ctx, color) ? 64 : Infinity;
  ctx.fillStyle = color;
  ctx.beginPath();
  let pending = 0;
  for (const polygon of polygons) {
    if (pending === batchSize) {
      ctx.fill('nonzero');
      ctx.beginPath();
      pending = 0;
    }
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let vertex = 1; vertex < polygon.length; vertex++) ctx.lineTo(polygon[vertex].x, polygon[vertex].y);
    ctx.closePath();
    pending++;
  }
  ctx.fill('nonzero');
}

function* processPoints(stroke: Stroke): Generator<RenderPoint> {
  const processor = new StrokeProcessor(stroke.brush);
  for (const point of stroke.points) yield processor.append(point);
}

export function canBatchOpaque(ctx: CanvasRenderingContext2D, color: string): boolean {
  const opaqueHex = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{3}f|[\da-f]{6}ff)$/i.test(color);
  return opaqueHex && ctx.globalAlpha === 1 && ctx.globalCompositeOperation === 'source-over'
    && ctx.filter === 'none' && ctx.shadowColor === 'rgba(0, 0, 0, 0)';
}
