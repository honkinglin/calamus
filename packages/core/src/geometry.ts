import { processStroke } from './stroke.js';
import type { Stroke } from './index.js';

export interface Vertex {
  x: number;
  y: number;
}

const circleTemplates = new Map<number, readonly Vertex[]>();

function unitCircle(steps: number): readonly Vertex[] {
  const cached = circleTemplates.get(steps);
  if (cached) return cached;
  const vertices: Vertex[] = [];
  for (let step = 0; step < steps; step++) {
    const angle = step * Math.PI * 2 / steps;
    vertices.push({ x: Math.cos(angle), y: Math.sin(angle) });
  }
  circleTemplates.set(steps, vertices);
  return vertices;
}

/** Clockwise polygons share a single fill to avoid alpha seams at overlaps. */
export function createStrokeGeometry(stroke: Stroke): Vertex[][] {
  const points = processStroke(stroke);
  const polygons: Vertex[][] = [];
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    const radius = point.width / 2;
    const steps = Math.max(12, Math.min(64, Math.ceil(Math.PI * Math.sqrt(radius * 8))));
    const circle: Vertex[] = [];
    for (const vertex of unitCircle(steps)) {
      circle.push({ x: point.x + vertex.x * radius, y: point.y + vertex.y * radius });
    }
    polygons.push(circle);
    const previous = points[index - 1];
    if (!previous) continue;
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (distance === 0) continue;
    const normalX = -(point.y - previous.y) / distance;
    const normalY = (point.x - previous.x) / distance;
    const previousRadius = previous.width / 2;
    polygons.push([
      { x: previous.x + normalX * previousRadius, y: previous.y + normalY * previousRadius },
      { x: previous.x - normalX * previousRadius, y: previous.y - normalY * previousRadius },
      { x: point.x - normalX * radius, y: point.y - normalY * radius },
      { x: point.x + normalX * radius, y: point.y + normalY * radius },
    ]);
  }
  return polygons;
}
