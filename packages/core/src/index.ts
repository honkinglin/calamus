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

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const polygons = createStrokeGeometry(stroke);
  ctx.fillStyle = stroke.brush.color;
  ctx.beginPath();
  for (const polygon of polygons) {
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (const vertex of polygon.slice(1)) ctx.lineTo(vertex.x, vertex.y);
    ctx.closePath();
  }
  ctx.fill('nonzero');
}

export { Calamus } from './engine.js';
export type { CalamusOptions, HistoryState } from './engine.js';

export { parseDocument } from './document.js';
export type { CalamusDocument } from './document.js';

export { createSVG } from './export.js';
