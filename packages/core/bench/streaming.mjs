import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import assert from 'node:assert/strict';
import { createGeometryFromPoints, iterateGeometry } from '../dist/geometry.js';
import { drawGeometry } from '../dist/render.js';

const points = Array.from({ length: 10000 }, (_, i) => ({ x: i / 10, y: Math.sin(i / 20) * 80, width: 6, time: i * 4, pressure: null }));
const rows = [];
let reference;
for (const mode of ['materialized', 'streaming']) {
  function run() {
    let vertices = 0, checksum = 0, fills = 0;
    const visit = (x, y) => { vertices++; checksum += x + y; };
    const ctx = { globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', shadowColor: 'rgba(0, 0, 0, 0)',
      beginPath() {}, closePath() {}, moveTo: visit, lineTo: visit, fill() { fills++; } };
    drawGeometry(ctx, '#123456', mode === 'materialized' ? createGeometryFromPoints(points) : iterateGeometry(points));
    return { vertices, checksum, fills };
  }
  for (let i = 0; i < 3; i++) run();
  const samplesMs = [];
  for (let i = 0; i < 15; i++) {
    const start = performance.now(); const result = run(); samplesMs.push(performance.now() - start);
    reference ??= result; assert.deepEqual(result, reference);
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  rows.push({ mode, medianMs: sorted[7], p95Ms: sorted[14], samplesMs });
}
console.log(JSON.stringify({ node: process.version, cpu: cpus()[0]?.model, points: points.length,
  warmup: 3, iterations: 15, result: reference, rows,
  notes: 'Node geometry and mock-command submission only; no Canvas rasterization or memory-peak measurement. Streaming avoids retaining the full JavaScript polygon array, but Canvas may still retain the entire transparent path internally.',
}, null, 2));
