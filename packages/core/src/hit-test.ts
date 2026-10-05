import { processStroke } from './stroke.js';
import type { Stroke } from './index.js';

export function hitsStroke(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const points = processStroke(stroke);
  return points.some((point, index) => {
    const previous = points[index - 1] ?? point;
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const lengthSquared = dx * dx + dy * dy;
    const projection = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
      ((x - previous.x) * dx + (y - previous.y) * dy) / lengthSquared));
    const nearestX = previous.x + projection * dx;
    const nearestY = previous.y + projection * dy;
    const width = previous.width + projection * (point.width - previous.width);
    return Math.hypot(x - nearestX, y - nearestY) <= radius + width / 2;
  });
}
