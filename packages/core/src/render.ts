import { createStrokeGeometry, createGeometryFromPoints } from './geometry.js';
import type { Vertex } from './geometry.js';
import type { Stroke } from './index.js';
import type { RenderPoint } from './stroke.js';

/** Opaque source-over strokes may be filled in bounded batches without alpha accumulation. */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  fillGeometry(ctx, stroke.brush.color, createStrokeGeometry(stroke));
}

export function drawProcessedStroke(ctx: CanvasRenderingContext2D, color: string, points: readonly RenderPoint[]): void {
  fillGeometry(ctx, color, createGeometryFromPoints(points));
}

function fillGeometry(ctx: CanvasRenderingContext2D, color: string, polygons: Vertex[][]): void {
  const opaqueHex = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{3}f|[\da-f]{6}ff)$/i.test(color);
  const batchSize = opaqueHex && ctx.globalAlpha === 1 && ctx.globalCompositeOperation === 'source-over'
    && ctx.filter === 'none' && ctx.shadowColor === 'rgba(0, 0, 0, 0)' ? 64 : Infinity;
  ctx.fillStyle = color;
  ctx.beginPath();
  let pending = 0;
  for (let index = 0; index < polygons.length; index++) {
    const polygon = polygons[index];
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let vertex = 1; vertex < polygon.length; vertex++) ctx.lineTo(polygon[vertex].x, polygon[vertex].y);
    ctx.closePath();
    pending++;
    if (pending === batchSize && index + 1 < polygons.length) {
      ctx.fill('nonzero');
      ctx.beginPath();
      pending = 0;
    }
  }
  ctx.fill('nonzero');
}
