import { processStroke } from './stroke.js';
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
  const [first, ...points] = processStroke(stroke);
  if (!first) return;

  ctx.fillStyle = ctx.strokeStyle = stroke.brush.color;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(first.x, first.y, first.width / 2, 0, Math.PI * 2);
  ctx.fill();

  let previous = first;
  for (const point of points) {
    ctx.lineWidth = (previous.width + point.width) / 2;
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    previous = point;
  }
}

export { Calamus } from './engine.js';
export type { CalamusOptions } from './engine.js';
