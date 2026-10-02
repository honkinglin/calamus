import type { Stroke } from './index.js';

export function replayDuration(strokes: readonly Stroke[]): number {
  return strokes.reduce((duration, stroke) => duration + (stroke.points.at(-1)?.time ?? 0) + 120, 0);
}

/** Strokes use relative timestamps, with a fixed pause between strokes. */
export function replayFrame(strokes: readonly Stroke[], elapsed: number): Stroke[] {
  const visible: Stroke[] = [];
  let remaining = Math.max(0, elapsed);
  for (const stroke of strokes) {
    const duration = stroke.points.at(-1)?.time ?? 0;
    if (remaining >= duration) visible.push(stroke);
    else {
      const points = stroke.points.filter(point => point.time <= remaining);
      if (points.length) visible.push({ brush: stroke.brush, points });
      break;
    }
    remaining -= duration + 120;
    if (remaining < 0) break;
  }
  return visible;
}
