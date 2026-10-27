import { performance } from 'node:perf_hooks';
import { cpus, release, arch } from 'node:os';
import { processStroke, createStrokeGeometry } from '../dist/index.js';

const iterations = 30;
const warmup = 5;
const scenarios = [
  { name: 'short', strokes: 1, pointsPerStroke: 1000 },
  { name: 'long', strokes: 1, pointsPerStroke: 10000 },
  { name: 'many', strokes: 100, pointsPerStroke: 100 },
];
const rows = [];
for (const scenario of scenarios) {
  const strokes = Array.from({ length: scenario.strokes }, (_, strokeIndex) => ({
    brush: { color: '#253631', size: 6, smoothing: 0.55, stabilizer: 12, velocityWidth: true },
    points: Array.from({ length: scenario.pointsPerStroke }, (_, index) => ({
      x: index / (scenario.pointsPerStroke - 1) * 1000,
      y: 100 + Math.sin(index / 20) * 50 + strokeIndex % 10 * 50,
      time: index * 4, pressure: null,
    })),
  }));
  for (const [name, operation] of [['process', processStroke], ['geometry', createStrokeGeometry]]) {
    const run = () => strokes.map(operation);
    for (let iteration = 0; iteration < warmup; iteration++) run();
    const timings = [];
    for (let iteration = 0; iteration < iterations; iteration++) {
      const start = performance.now();
      run();
      timings.push(performance.now() - start);
    }
    timings.sort((a, b) => a - b);
    let retainedHeapBytes = null;
    if (global.gc) {
      global.gc();
      const before = process.memoryUsage().heapUsed;
      let result = run();
      global.gc();
      retainedHeapBytes = Math.max(0, process.memoryUsage().heapUsed - before);
      // Keep the measured output reachable until after the heap sample.
      if (result.length !== scenario.strokes) throw new Error('Unexpected result count.');
      result = null;
      global.gc();
    }
    rows.push({ ...scenario, operation: name,
      medianMs: (timings[14] + timings[15]) / 2,
      p95Ms: timings[Math.ceil(iterations * 0.95) - 1], retainedHeapBytes });
  }
}
console.log(JSON.stringify({
  environment: { node: process.version, platform: process.platform, release: release(), arch: arch(), cpu: cpus()[0]?.model },
  warmup, iterations, rows,
  notes: 'Timings measure complete scenario CPU computation in Node, not browser frames. Retained heap is a single post-GC output delta, not peak memory, allocation traffic, or Canvas/GPU memory. Scenarios use bounded logical coordinates; not directly comparable with the earlier unbounded sample.',
}, null, 2));
