import { createStrokeGeometry, drawStroke } from '@calamus/core';
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
function drawReference(context: CanvasRenderingContext2D, stroke: Stroke): void {
  context.fillStyle = stroke.brush.color;
  context.beginPath();
  for (const polygon of createStrokeGeometry(stroke)) {
    context.moveTo(polygon[0].x, polygon[0].y);
    for (let vertex = 1; vertex < polygon.length; vertex++) context.lineTo(polygon[vertex].x, polygon[vertex].y);
    context.closePath();
  }
  context.fill('nonzero');
}

/** Raster comparison runs outside timed scenarios, at a fixed 1000 × 700 resolution. */
function compareRaster() {
  const a = document.createElement('canvas'), b = document.createElement('canvas');
  a.width = b.width = 1000; a.height = b.height = 700;
  const first = a.getContext('2d')!, second = b.getContext('2d')!;
  return ['#254e43', '#254e4366'].map(color => {
    first.clearRect(0, 0, 1000, 700); second.clearRect(0, 0, 1000, 700);
    const stroke = benchmarkStrokes(1, 2000)[0]; stroke.brush.color = color;
    drawStroke(first, stroke); drawReference(second, stroke);
    const actual = first.getImageData(0, 0, 1000, 700).data;
    const expected = second.getImageData(0, 0, 1000, 700).data;
    let changedPixels = 0, maxAlphaDelta = 0, absoluteAlphaDelta = 0, missingSolidPixels = 0;
    for (let index = 0; index < actual.length; index += 4) {
      if (actual[index] !== expected[index] || actual[index + 1] !== expected[index + 1]
        || actual[index + 2] !== expected[index + 2] || actual[index + 3] !== expected[index + 3]) changedPixels++;
      const delta = Math.abs(actual[index + 3] - expected[index + 3]);
      maxAlphaDelta = Math.max(maxAlphaDelta, delta); absoluteAlphaDelta += delta;
      if (expected[index + 3] === 255 && actual[index + 3] === 0) missingSolidPixels++;
    }
    return { color, changedPixels, maxAlphaDelta, absoluteAlphaDelta, missingSolidPixels, pixels: 700000 };
  });
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
export async function runBrowserBenchmark(canvas: HTMLCanvasElement, signal: AbortSignal, onScenario: (name: string) => void = () => {}, renderer: 'optimized' | 'reference' = 'optimized') {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D unavailable.');
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(1000 * ratio);
  canvas.height = Math.round(700 * ratio);
  context.setTransform(canvas.width / 1000, 0, 0, canvas.height / 700, 0, 0);
  const rows = [];
  const scenarios: [string, number, number][] = [['empty', 0, 0], ['short', 1, 1000], ['long', 1, 2000], ['many', 100, 100]];
  if (renderer === 'optimized') scenarios.push(['dense', 1, 10000]);
  for (const [name, count, points] of scenarios) {
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
      for (const stroke of strokes) {
        if (renderer === 'optimized') drawStroke(context, stroke);
        else {
          drawReference(context, stroke);
        }
      }
      const duration = performance.now() - start;
      if (index >= 5) { cpu.push(duration); intervals.push(time - previous!); }
      previous = time;
    }
    rows.push({ name, strokes: count, pointsPerStroke: points, frames: cpu.length,
      submissionMs: summarize(cpu), frameIntervalMs: summarize(intervals),
      heapBefore, heapAfter: heapBytes(), submissionSamplesMs: cpu, frameSamplesMs: intervals });
  }
  return { schemaVersion: 1, renderer, recordedAt: new Date().toISOString(), userAgent: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio, canvasWidth: canvas.width, canvasHeight: canvas.height,
    rasterComparison: compareRaster(),
    estimatedCanvasRGBABytes: canvas.width * canvas.height * 4, warmupFrames: 5, rows,
    notes: 'Full redraw microbenchmark, not interactive engine FPS. Submission time excludes GPU completion; rAF intervals include scheduling and unrelated work. Heap values are optional non-standard whole-page estimates, not peak or retained memory. RGBA bytes estimate one buffer only. DPR capped at 2.' };
}
