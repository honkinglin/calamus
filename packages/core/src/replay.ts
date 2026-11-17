import type { Stroke } from './index.js';

export function replayDuration(strokes: readonly Stroke[]): number {
  return strokes.reduce((duration, stroke) => duration + (stroke.points.at(-1)?.time ?? 0) + 120, 0);
}

/** Compare on the same timeline to avoid subtractive rounding at sample boundaries. */
function partialStroke(stroke: Stroke, elapsed: number, start = 0): Stroke | undefined {
  let low = 0;
  let high = stroke.points.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (start + stroke.points[middle]!.time <= elapsed) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return;
  return { brush: stroke.brush, points: stroke.points.slice(0, low) };
}

/** Strokes use relative timestamps, with a fixed pause between strokes. */
export function replayFrame(strokes: readonly Stroke[], elapsed: number): Stroke[] {
  const visible: Stroke[] = [];
  let remaining = Math.max(0, elapsed);
  for (const stroke of strokes) {
    const duration = stroke.points.at(-1)?.time ?? 0;
    if (remaining >= duration) visible.push(stroke);
    else {
      const partial = partialStroke(stroke, remaining);
      if (partial) visible.push(partial);
      break;
    }
    remaining -= duration + 120;
    if (remaining < 0) break;
  }
  return visible;
}

/** A session-local index; rebuild when starting playback of another document. */
export function createReplayTimeline(strokes: readonly Stroke[]) {
  const source = [...strokes];
  let duration = 0;
  const ends = source.map(stroke => {
    const end = duration + (stroke.points.at(-1)?.time ?? 0);
    duration = end + 120;
    return end;
  });
  return {
    duration,
    frame(elapsed: number): Stroke[] {
      const time = Math.max(0, elapsed);
      let low = 0;
      let high = ends.length;
      while (low < high) {
        const middle = low + Math.floor((high - low) / 2);
        if (ends[middle]! <= time) low = middle + 1;
        else high = middle;
      }
      const visible = source.slice(0, low);
      const next = source[low];
      const start = low === 0 ? 0 : ends[low - 1]! + 120;
      if (next && time >= start) {
        const partial = partialStroke(next, time, start);
        if (partial) visible.push(partial);
      }
      return visible;
    },
  };
}
