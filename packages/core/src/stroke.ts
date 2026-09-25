import type { Point, Stroke } from './index.js';

export interface RenderPoint extends Point {
  width: number;
}

/** Pure processing keeps export and canvas redraw independent of frame timing. */
export function processStroke(stroke: Stroke): RenderPoint[] {
  const { points, brush } = stroke;
  if (!points.length) return [];
  const smoothing = brush.smoothing ?? 0;
  const radius = brush.stabilizer ?? 0;
  const result: RenderPoint[] = [];
  let filteredPressure = points[0].pressure ?? 0.5;
  let tip = { ...points[0] };
  let previous = points[0];

  for (const point of points) {
    const elapsed = Math.max(1, point.time - previous.time);
    const velocity = Math.hypot(point.x - previous.x, point.y - previous.y) / elapsed;
    const distance = Math.hypot(point.x - tip.x, point.y - tip.y);
    const follow = distance > 0 ? Math.max(0, distance - radius) / distance : 0;
    const targetX = tip.x + (point.x - tip.x) * follow;
    const targetY = tip.y + (point.y - tip.y) * follow;
    const response = smoothing === 0 ? 1 : 1 - Math.exp(-elapsed / (1 + smoothing * 24 / (1 + velocity * 3)));
    tip = { ...point, x: tip.x + (targetX - tip.x) * response, y: tip.y + (targetY - tip.y) * response };
    const pressureResponse = 1 - Math.exp(-elapsed / 12);
    filteredPressure += ((point.pressure ?? 0.5) - filteredPressure) * pressureResponse;
    let multiplier = 1;
    if (point.pressure !== null) multiplier = 0.4 + filteredPressure * 1.2;
    else if (brush.velocityWidth) multiplier = 0.45 + 0.75 / (1 + velocity);
    result.push({ ...tip, width: brush.size * multiplier });
    previous = point;
  }
  return result;
}
