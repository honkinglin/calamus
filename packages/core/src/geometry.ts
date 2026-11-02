import type { RenderPoint } from './stroke.js';
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
  return createGeometryFromPoints(processStroke(stroke));
}

export function createGeometryFromPoints(points: readonly RenderPoint[]): Vertex[][] {
  return Array.from(iterateGeometry(points));
}

/** Generates only the current sample's polygons; consumers need not retain the full geometry. */
export function* iterateGeometry(points: Iterable<RenderPoint>): Generator<Vertex[]> {
  let previous: RenderPoint | undefined;
  for (const point of points) {
    yield* createPointGeometry(point, previous);
    previous = point;
  }
}

function createPointGeometry(point: RenderPoint, previous?: RenderPoint): Vertex[][] {
  const polygons: Vertex[][] = [];
  const radius = point.width / 2;
  const steps = Math.max(12, Math.min(64, Math.ceil(Math.PI * Math.sqrt(radius * 8))));
  const circle: Vertex[] = [];
  for (const vertex of unitCircle(steps)) {
    circle.push({ x: point.x + vertex.x * radius, y: point.y + vertex.y * radius });
  }
  polygons.push(circle);
  if (!previous) return polygons;
  const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
  if (distance === 0) return polygons;
  const normalX = -(point.y - previous.y) / distance;
  const normalY = (point.x - previous.x) / distance;
  const previousRadius = previous.width / 2;
  polygons.push([
    { x: previous.x + normalX * previousRadius, y: previous.y + normalY * previousRadius },
    { x: previous.x - normalX * previousRadius, y: previous.y - normalY * previousRadius },
    { x: point.x - normalX * radius, y: point.y - normalY * radius },
    { x: point.x + normalX * radius, y: point.y + normalY * radius },
  ]);
  return polygons;
}

/** Gesture-local cache. On overflow, release geometry and use the batch renderer. */
export class StrokeGeometryCache {
  private polygons: Vertex[][] = [];
  private previous?: RenderPoint;
  private vertices = 0;
  private overflow = false;

  constructor(private readonly vertexLimit = 100_000) {}

  append(point: RenderPoint): void {
    if (this.overflow) return;
    const added = createPointGeometry(point, this.previous);
    const count = added.reduce((sum, polygon) => sum + polygon.length, 0);
    if (this.vertices + count > this.vertexLimit) {
      this.polygons = [];
      this.previous = undefined;
      this.vertices = 0;
      this.overflow = true;
      return;
    }
    this.polygons.push(...added);
    this.vertices += count;
    this.previous = { ...point };
  }

  get geometry(): readonly (readonly Vertex[])[] | null { return this.overflow ? null : this.polygons; }
  get vertexCount(): number { return this.vertices; }
}
