import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import assert from 'node:assert/strict';
import { StrokeProcessor, processStroke } from '../dist/stroke.js';

const brush = { color: '#253631', size: 6, smoothing: 0.55, stabilizer: 8, velocityWidth: true };
const points = Array.from({ length: 10000 }, (_, i) => ({
  x: i / 10, y: Math.sin(i / 20) * 80, time: i * 4, pressure: i % 3 ? (i % 100) / 100 : null,
}));
const modes = {
  batchPrefixes() {
    let output;
    for (let end = 16; end <= points.length; end += 16) output = processStroke({ brush, points: points.slice(0, end) });
    return output;
  },
  incremental() {
    const processor = new StrokeProcessor(brush);
    const output = [];
    for (let end = 16; end <= points.length; end += 16) {
      for (let i = end - 16; i < end; i++) output.push(processor.append(points[i]));
    }
    return output;
  },
};
const reference = modes.batchPrefixes();
const rows = [];
for (const [name, operation] of Object.entries(modes)) {
  for (let i = 0; i < 3; i++) operation();
  const samplesMs = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    const result = operation();
    samplesMs.push(performance.now() - start);
    assert.deepEqual(result, reference);
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  rows.push({ name, medianMs: (sorted[4] + sorted[5]) / 2, p95Ms: sorted[9], samplesMs });
}
console.log(JSON.stringify({ node: process.version, cpu: cpus()[0]?.model, points: points.length,
  samplesPerFrame: 16, simulatedFrames: 625, warmup: 3, iterations: 10, rows,
  notes: 'Node sampling-only microbenchmark; excludes geometry, Canvas, events and display. Incremental mode retains one processed point per raw sample for the active gesture. Timing is total processing across all simulated frames, not per-frame latency.',
}, null, 2));
