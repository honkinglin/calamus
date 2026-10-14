import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { processStroke, createStrokeGeometry } from '../dist/index.js';

console.log(JSON.stringify({ node: process.version, platform: process.platform, cpu: cpus()[0]?.model }));
for (const count of [1000, 10000]) {
  const stroke = {
    brush: { color: '#253631', size: 6, smoothing: 0.55, stabilizer: 12, velocityWidth: true },
    points: Array.from({ length: count }, (_, index) => ({
      x: index / 10, y: 100 + Math.sin(index / 20) * 50, time: index * 4, pressure: null,
    })),
  };
  for (const [name, operation] of [['process', processStroke], ['geometry', createStrokeGeometry]]) {
    for (let iteration = 0; iteration < 5; iteration++) operation(stroke);
    const timings = [];
    for (let iteration = 0; iteration < 30; iteration++) {
      const start = performance.now();
      operation(stroke);
      timings.push(performance.now() - start);
    }
    timings.sort((a, b) => a - b);
    console.log(JSON.stringify({ operation: name, points: count, medianMs: timings[15], p95Ms: timings[28] }));
  }
}
