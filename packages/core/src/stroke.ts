import type { Brush, Point, Stroke } from './index.js';

export interface RenderPoint extends Point {
  width: number;
}

/** One processor per gesture; snapshots brush settings and consumes each sample once. */
export class StrokeProcessor {
  private brush: Brush;
  private previous?: Point;
  private tip?: Point;
  private filteredPressure?: number;
  private travelled = 0;
  constructor(brush: Brush) { this.brush = { ...brush }; }

  append(point: Point): RenderPoint {
    const brush = this.brush;
    const smoothing = brush.smoothing ?? 0;
    const radius = brush.stabilizer ?? 0;
    const previous = this.previous ?? point;
    const tip = this.tip ?? point;
    const elapsed = Math.max(1, point.time - previous.time);
    const velocity = Math.hypot(point.x - previous.x, point.y - previous.y) / elapsed;
    this.travelled += Math.hypot(point.x - previous.x, point.y - previous.y);
    const effectiveRadius = radius === 0 ? 0 : radius * (1 - Math.exp(-this.travelled / (radius * 2)));
    const distance = Math.hypot(point.x - tip.x, point.y - tip.y);
    const follow = distance > 0 ? Math.max(0, distance - effectiveRadius) / distance : 0;
    const targetX = tip.x + (point.x - tip.x) * follow;
    const targetY = tip.y + (point.y - tip.y) * follow;
    const response = smoothing === 0 ? 1 : 1 - Math.exp(-elapsed / (1 + smoothing * 24 / (1 + velocity * 3)));
    this.tip = { ...point, x: tip.x + (targetX - tip.x) * response, y: tip.y + (targetY - tip.y) * response };
    const pressureResponse = 1 - Math.exp(-elapsed / 12);
    let filteredPressure = this.filteredPressure ?? (point.pressure ?? 0.5);
    filteredPressure += ((point.pressure ?? 0.5) - filteredPressure) * pressureResponse;
    this.filteredPressure = filteredPressure;
    let multiplier = 1;
    if (point.pressure !== null) multiplier = 0.4 + filteredPressure * 1.2;
    else if (brush.velocityWidth) multiplier = 0.45 + 0.75 / (1 + velocity);
    this.previous = { ...point };
    return { ...this.tip, width: brush.size * multiplier };
  }
}

/** Batch processing and live input share exactly the same state transitions. */
export function processStroke(stroke: Stroke): RenderPoint[] {
  const processor = new StrokeProcessor(stroke.brush);
  return stroke.points.map(point => processor.append(point));
}
