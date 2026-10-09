import { createStrokeGeometry } from './geometry.js';
import type { Stroke } from './index.js';

export interface CropOptions {
  crop?: boolean;
  padding?: number;
}

export function exportBounds(strokes: readonly Stroke[], width: number, height: number, options: CropOptions = {}) {
  const padding = options.padding ?? 12;
  if (!Number.isFinite(padding) || padding < 0 || padding > 4096) {
    throw new RangeError('Export padding must be between zero and 4096.');
  }
  const full = { x: 0, y: 0, width, height };
  if (!options.crop) return full;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const stroke of strokes) {
    for (const polygon of createStrokeGeometry(stroke)) {
      for (const vertex of polygon) {
        left = Math.min(left, vertex.x);
        top = Math.min(top, vertex.y);
        right = Math.max(right, vertex.x);
        bottom = Math.max(bottom, vertex.y);
      }
    }
  }
  if (left === Infinity) return full;
  const x = Math.floor(left - padding);
  const y = Math.floor(top - padding);
  return { x, y, width: Math.max(1, Math.ceil(right + padding) - x), height: Math.max(1, Math.ceil(bottom + padding) - y) };
}
