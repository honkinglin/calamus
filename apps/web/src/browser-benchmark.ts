import { drawStroke } from '@calamus/core';
import type { Stroke } from '@calamus/core';

export function summarize(values: number[]) {
  if (!values.length || values.some(value => !Number.isFinite(value))) throw new Error('Expected finite samples.');
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return { median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1] };
}
export function benchmarkStrokes(count: number, points: number): Stroke[] {
  return Array.from({ length: count }, (_, stroke) => ({
    brush: { color: '#254e43', size: 4, smoothing: 0.55, stabilizer: 12, velocityWidth: true },
    points: Array.from({ length: points }, (_, index) => ({
      x: index / (points - 1) * 1000,
      y: 60 + stroke % 10 * 60 + Math.sin(index / 20) * 35,
      time: index * 4, pressure: null,
    })),
  }));
}
function frame(signal: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Measurement cancelled.')); return; }
    const cleanup = () => { clearTimeout(timeout); signal.removeEventListener('abort', abort); };
    const abort = () => { cancelAnimationFrame(id); cleanup(); reject(new Error('Measurement cancelled.')); };
    const timeout = setTimeout(() => {
      cancelAnimationFrame(id); cleanup(); reject(new Error('Frame scheduling stalled. Try a foreground tab.'));
    }, 5000);
    const id = requestAnimationFrame(time => { cleanup(); resolve(time); });
    signal.addEventListener('abort', abort, { once: true });
  });
}
function heapBytes(): number | null {
  const value = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
export async function runBrowserBenchmark(canvas: HTMLCanvasElement, signal: AbortSignal, onScenario: (name: string) => void = () => {}) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D unavailable.');
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(1000 * ratio);
  canvas.height = Math.round(700 * ratio);
  context.setTransform(canvas.width / 1000, 0, 0, canvas.height / 700, 0, 0);
  const rows = [];
  for (const [name, count, points] of [['empty', 0, 0], ['short', 1, 1000], ['long', 1, 2000], ['many', 100, 100]] as const) {
    onScenario(name);
    const strokes = benchmarkStrokes(count, points);
    const cpu: number[] = [], intervals: number[] = [];
    const heapBefore = heapBytes();
    let previous: number | undefined;
    for (let index = 0; index < 35; index++) {
      const time = await frame(signal);
      if (signal.aborted || document.hidden) throw new Error('Measurement interrupted. Keep this tab visible.');
      const start = performance.now();
      context.clearRect(0, 0, 1000, 700);
      for (const stroke of strokes) drawStroke(context, stroke);
      const duration = performance.now() - start;
      if (index >= 5) { cpu.push(duration); intervals.push(time - previous!); }
      previous = time;
    }
    rows.push({ name, strokes: count, pointsPerStroke: points, frames: cpu.length,
      submissionMs: summarize(cpu), frameIntervalMs: summarize(intervals),
      heapBefore, heapAfter: heapBytes(), submissionSamplesMs: cpu, frameSamplesMs: intervals });
  }
  return { schemaVersion: 1, recordedAt: new Date().toISOString(), userAgent: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio, canvasWidth: canvas.width, canvasHeight: canvas.height,
    estimatedCanvasRGBABytes: canvas.width * canvas.height * 4, warmupFrames: 5, rows,
    notes: 'Full redraw microbenchmark, not interactive engine FPS. Submission time excludes GPU completion; rAF intervals include scheduling and unrelated work. Heap values are optional non-standard whole-page estimates, not peak or retained memory. RGBA bytes estimate one buffer only. DPR capped at 2.' };
}
