export interface Point {
  x: number;
  y: number;
  pressure: number | null;
  time: number;
}

export interface Brush {
  color: string;
  size: number;
}

export interface Stroke {
  brush: Brush;
  points: Point[];
}

export const PAPER = { width: 1000, height: 700 };

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const [first, ...points] = stroke.points;
  if (!first) return;

  const width = (point: Point) => stroke.brush.size * (point.pressure === null ? 1 : 0.4 + point.pressure * 1.2);
  ctx.fillStyle = ctx.strokeStyle = stroke.brush.color;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(first.x, first.y, width(first) / 2, 0, Math.PI * 2);
  ctx.fill();

  let previous = first;
  for (const point of points) {
    ctx.lineWidth = (width(previous) + width(point)) / 2;
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    previous = point;
  }
}

export { Calamus } from './engine.js';
export type { CalamusOptions } from './engine.js';
