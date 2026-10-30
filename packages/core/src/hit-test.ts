import { processStroke } from './stroke.js';
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

function hitsPolygon(polygon: readonly Vertex[], start: Vertex, end: Vertex, radius: number): boolean {
  let inside = true;
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    if (segmentsTouch(start, end, a, b, radius)) return true;
    if (cross(a, b, start) < 0) inside = false;
  }
  return inside;
}

/** Uncached entry point remains safe for caller-owned mutable strokes. */
export function hitsStrokeSweep(stroke: Stroke, start: Vertex, end: Vertex, radius: number): boolean {
  return createStrokeGeometry(stroke).some(polygon => hitsPolygon(polygon, start, end, radius));
}

type Bounds = { left: number; top: number; right: number; bottom: number };
const emptyBounds = (): Bounds => ({ left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
function include(bounds: Bounds, point: Vertex, radius = 0): void {
  bounds.left = Math.min(bounds.left, point.x - radius);
  bounds.top = Math.min(bounds.top, point.y - radius);
  bounds.right = Math.max(bounds.right, point.x + radius);
  bounds.bottom = Math.max(bounds.bottom, point.y + radius);
}
function overlaps(a: Bounds, b: Bounds): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

/** Gesture-local cache for immutable committed strokes; never cache mutable public input. */
export class StrokeHitCache {
  private bounds = new WeakMap<Stroke, Bounds>();
  private geometry = new Map<Stroke, { polygons: Vertex[][]; bounds: Bounds[]; vertices: number }>();
  private vertices = 0;
  constructor(private maxVertices = 100_000, private maxEntries = 32) {}
  get stats() { return { entries: this.geometry.size, vertices: this.vertices }; }
  clear(): void {
    this.bounds = new WeakMap(); this.geometry.clear(); this.vertices = 0;
  }
  hits(stroke: Stroke, start: Vertex, end: Vertex, radius: number): boolean {
    let bounds = this.bounds.get(stroke);
    if (!bounds) {
      bounds = emptyBounds();
      for (const point of processStroke(stroke)) include(bounds, point, point.width / 2);
      this.bounds.set(stroke, bounds);
    }
    const sweep = emptyBounds(); include(sweep, start, radius); include(sweep, end, radius);
    if (!overlaps(bounds, sweep)) return false;
    let cached = this.geometry.get(stroke);
    if (cached) {
      this.geometry.delete(stroke); this.geometry.set(stroke, cached);
    } else {
      const polygons = createStrokeGeometry(stroke);
      cached = { polygons, vertices: 0, bounds: polygons.map(polygon => {
        const bounds = emptyBounds();
        for (const vertex of polygon) include(bounds, vertex);
        return bounds;
      }) };
      cached.vertices = polygons.reduce((sum, polygon) => sum + polygon.length, 0);
      if (cached.vertices <= this.maxVertices && this.maxEntries > 0) {
        while (this.geometry.size && (this.vertices + cached.vertices > this.maxVertices || this.geometry.size >= this.maxEntries)) {
          const oldest = this.geometry.keys().next().value!;
          this.vertices -= this.geometry.get(oldest)!.vertices; this.geometry.delete(oldest);
        }
        this.geometry.set(stroke, cached); this.vertices += cached.vertices;
      }
    }
    return cached.polygons.some((polygon, index) => overlaps(cached.bounds[index], sweep) && hitsPolygon(polygon, start, end, radius));
  }
}

export function hitsStroke(stroke: Stroke, x: number, y: number, radius: number): boolean {
  return hitsStrokeSweep(stroke, { x, y }, { x, y }, radius);
}
