import { exportBounds } from './bounds.js';
import type { CropOptions } from './bounds.js';
import { createStrokeGeometry } from './geometry.js';
import type { Stroke } from './index.js';

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]!);
}

/** Export the same filled geometry used by the canvas renderer. */
export function createSVG(strokes: readonly Stroke[], width: number, height: number, options: CropOptions = {}): string {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError('SVG dimensions must be positive finite numbers.');
  }
  const bounds = exportBounds(strokes, width, height, options);
  const paths = strokes.map(stroke => {
    const polygons = createStrokeGeometry(stroke);
    const commands = polygons.map(polygon => polygon.map((point, index) => {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new TypeError('Invalid SVG coordinates.');
      return `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`;
    }).join(' ') + ' Z').join(' ');
    return `<path fill="${escapeAttribute(stroke.brush.color)}" fill-rule="nonzero" d="${commands}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}">${paths.join('')}</svg>`;
}
