import { createStrokeGeometry } from './geometry.js';
import type { Vertex } from './geometry.js';
import type { Stroke } from './index.js';

function cross(a: Vertex, b: Vertex, point: Vertex): number {
  return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
}

function distanceToSegment(point: Vertex, start: Vertex, end: Vertex): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / length));
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy);
}

function segmentsTouch(a: Vertex, b: Vertex, c: Vertex, d: Vertex, radius: number): boolean {
  const first = cross(a, b, c);
  const second = cross(a, b, d);
  const third = cross(c, d, a);
  const fourth = cross(c, d, b);
  if (first * second < 0 && third * fourth < 0) return true;
  return Math.min(
    distanceToSegment(a, c, d), distanceToSegment(b, c, d),
    distanceToSegment(c, a, b), distanceToSegment(d, a, b),
  ) <= radius;
}

/** Intersect a swept circular eraser with the filled stroke polygons. */
export function hitsStrokeSweep(stroke: Stroke, start: Vertex, end: Vertex, radius: number): boolean {
  return createStrokeGeometry(stroke).some(polygon => {
    let inside = true;
    for (let index = 0; index < polygon.length; index++) {
      const a = polygon[index];
      const b = polygon[(index + 1) % polygon.length];
      if (segmentsTouch(start, end, a, b, radius)) return true;
      if (cross(a, b, start) < 0) inside = false;
    }
    return inside;
  });
}

export function hitsStroke(stroke: Stroke, x: number, y: number, radius: number): boolean {
  return hitsStrokeSweep(stroke, { x, y }, { x, y }, radius);
}
