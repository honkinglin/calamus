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
      // Input timestamps are monotonic. Find the first future sample without
      // reading the entire unrevealed tail on every animation frame.
      let low = 0;
      let high = stroke.points.length;
      while (low < high) {
        const middle = low + Math.floor((high - low) / 2);
        if (stroke.points[middle]!.time <= remaining) low = middle + 1;
        else high = middle;
      }
      const points = stroke.points.slice(0, low);
      if (points.length) visible.push({ brush: stroke.brush, points });
      break;
    }
    remaining -= duration + 120;
    if (remaining < 0) break;
  }
  return visible;
}
