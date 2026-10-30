import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { hitsStrokeSweep, StrokeHitCache } from '../dist/hit-test.js';

const strokes = Array.from({ length: 100 }, (_, index) => ({
  brush: { color: '#253631', size: 6, smoothing: 0.55, stabilizer: 8 },
  points: Array.from({ length: 40 }, (_, point) => ({
    x: index % 10 * 100 + point,
    y: Math.floor(index / 10) * 65 + Math.sin(point / 5) * 12 + 20,
    time: point * 8, pressure: null,
  })),
}));
const queries = Array.from({ length: 30 }, (_, index) => ({
  start: { x: index * 33, y: 15 }, end: { x: index * 33 + 20, y: 40 },
}));
function run(hit) {
  let hits = 0;
  for (const { start, end } of queries) for (const stroke of strokes) if (hit(stroke, start, end, 10)) hits++;
  return hits;
}
const reference = run(hitsStrokeSweep);
const warmCache = new StrokeHitCache();
const modes = {
  uncached: () => run(hitsStrokeSweep),
  gestureCold: () => { const cache = new StrokeHitCache(); return run(cache.hits.bind(cache)); },
  gestureWarm: () => run(warmCache.hits.bind(warmCache)),
};
const rows = [];
for (const [name, operation] of Object.entries(modes)) {
  for (let i = 0; i < 3; i++) operation();
  const samples = [];
  for (let i = 0; i < 15; i++) {
    const start = performance.now();
    const hits = operation();
    samples.push(performance.now() - start);
    if (hits !== reference) throw new Error('Hit results diverged.');
  }
  samples.sort((a, b) => a - b);
  rows.push({ name, medianMs: samples[7], p95Ms: samples[14] });
}
console.log(JSON.stringify({ node: process.version, cpu: cpus()[0]?.model, strokes: 100, pointsPerStroke: 40,
  queries: 30, warmup: 3, iterations: 15, hitsPerRun: reference, rows, cache: warmCache.stats,
  notes: 'Node sweep-query microbenchmark; not pointer latency. Cold creates a new gesture cache each run; warm reuses one cache. Mostly distant misses with some intersecting strokes. No rendering included.',
}, null, 2));
