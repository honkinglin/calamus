import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import assert from 'node:assert/strict';
import { StrokeGeometryCache, createGeometryFromPoints } from '../dist/geometry.js';

const rows = [];
for (const count of [2000, 10000]) {
  const points = Array.from({ length: count }, (_, i) => ({
    x: i / 10, y: Math.sin(i / 20) * 80, width: 6, time: i * 4, pressure: null,
  }));
  const reference = createGeometryFromPoints(points);
  for (const mode of ['batchPrefixes', 'cached']) {
    function run() {
      const cache = new StrokeGeometryCache();
      let output;
      for (let end = 16; end <= count; end += 16) {
        if (mode === 'cached') for (let i = end - 16; i < end; i++) cache.append(points[i]);
        output = mode === 'cached' && cache.geometry ? cache.geometry : createGeometryFromPoints(points.slice(0, end));
      }
      return { output, retainedVertices: cache.vertexCount, fallback: cache.geometry === null };
    }
    for (let i = 0; i < 3; i++) run();
    const samplesMs = [];
    let result;
    for (let i = 0; i < 10; i++) {
      const start = performance.now(); result = run(); samplesMs.push(performance.now() - start);
      assert.deepEqual(result.output, reference);
    }
    const sorted = [...samplesMs].sort((a, b) => a - b);
    rows.push({ count, mode, medianMs: (sorted[4] + sorted[5]) / 2, p95Ms: sorted[9],
      retainedVertices: result.retainedVertices, fallback: result.fallback, samplesMs });
  }
}
console.log(JSON.stringify({ node: process.version, cpu: cpus()[0]?.model, samplesPerFrame: 16,
  vertexLimit: 100000, warmup: 3, iterations: 10, rows,
  notes: 'Node geometry-only cumulative gesture time, excluding sampling and Canvas. Cache is bounded; over-budget gestures fall back to full geometry generation. Vertex count is not a byte or peak-memory measurement.',
}, null, 2));
