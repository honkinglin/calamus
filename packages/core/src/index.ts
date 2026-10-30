import { createStrokeGeometry } from './geometry.js';
export { createStrokeGeometry } from './geometry.js';
export type { Vertex } from './geometry.js';
export { processStroke } from './stroke.js';
export type { RenderPoint } from './stroke.js';

export interface Point {
  x: number;
  y: number;
  pressure: number | null;
  time: number;
}

export interface Brush {
  color: string;
  size: number;
  smoothing?: number;
  stabilizer?: number;
  velocityWidth?: boolean;
}

export interface Stroke {
  brush: Brush;
  points: Point[];
}

export const PAPER = { width: 1000, height: 700 };

/** Opaque source-over strokes may be filled in bounded batches without alpha accumulation. */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const polygons = createStrokeGeometry(stroke);
  const opaqueHex = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{3}f|[\da-f]{6}ff)$/i.test(stroke.brush.color);
  const batchSize = opaqueHex && ctx.globalAlpha === 1 && ctx.globalCompositeOperation === 'source-over'
    && ctx.filter === 'none' && ctx.shadowColor === 'rgba(0, 0, 0, 0)' ? 64 : Infinity;
  ctx.fillStyle = stroke.brush.color;
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

export { Calamus } from './engine.js';
export type { CalamusOptions, HistoryState, ReplayState, PNGExportOptions } from './engine.js';

export { parseDocument } from './document.js';
export type { CalamusDocument } from './document.js';

export { createSVG } from './export.js';

export type { CropOptions } from './bounds.js';
