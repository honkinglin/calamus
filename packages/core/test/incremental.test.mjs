import test from 'node:test';
import assert from 'node:assert/strict';
import { StrokeProcessor, processStroke } from '../dist/stroke.js';
import { createGeometryFromPoints, createStrokeGeometry } from '../dist/geometry.js';
import { referenceProcessStroke } from './helpers/stroke-reference.mjs';

const points = Array.from({ length: 80 }, (_, index) => ({
  x: Math.round(Math.sin(index / 7) * 90), y: index % 11 === 0 ? 0 : index * 2,
  time: Math.floor(index / 2) * 8, pressure: index % 3 === 0 ? null : (index % 5) / 4,
}));
test('incremental samples exactly match the frozen batch algorithm at every prefix', () => {
  for (const smoothing of [0, 0.55, 1]) for (const stabilizer of [0, 12, 24]) for (const velocityWidth of [true, false]) {
    const brush = { color: '#123456', size: 10, smoothing, stabilizer, velocityWidth };
    const processor = new StrokeProcessor(brush);
    const processed = [];
    for (let count = 1; count <= points.length; count++) {
      processed.push(processor.append(points[count - 1]));
      const stroke = { brush, points: points.slice(0, count) };
      assert.deepEqual(processed, referenceProcessStroke(stroke));
      assert.deepEqual(createGeometryFromPoints(processed), createStrokeGeometry(stroke));
    }
    assert.deepEqual(processed, processStroke({ brush, points }));
  }
});
test('processor snapshots input and brush and does not leak state through returned points', () => {
  const brush = { color: '#000', size: 10, smoothing: 0.55 };
  const processor = new StrokeProcessor(brush);
  const original = structuredClone(points[0]);
  const input = { ...original };
  const first = processor.append(input);
  input.x = 999; first.x = 999; brush.size = 900;
  assert.deepEqual(processor.append(points[1]), referenceProcessStroke({
    brush: { color: '#000', size: 10, smoothing: 0.55 }, points: [original, points[1]],
  })[1]);
});

test('active processed rendering matches batch rendering for opaque and translucent strokes', async () => {
  const { drawStroke, drawProcessedStroke } = await import('../dist/render.js');
  function context() {
    const commands = [];
    const ctx = { globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', shadowColor: 'rgba(0, 0, 0, 0)' };
    for (const method of ['beginPath', 'moveTo', 'lineTo', 'closePath', 'fill']) ctx[method] = (...args) => commands.push([method, ...args]);
    return { ctx, commands };
  }
  for (const color of ['#123456', '#12345666']) {
    const brush = { color, size: 8, smoothing: 0.6, stabilizer: 12 };
    const processor = new StrokeProcessor(brush);
    const processed = [];
    for (let i = 0; i < points.length; i++) {
      processed.push(processor.append(points[i]));
      const active = context();
      const batch = context();
      drawProcessedStroke(active.ctx, color, processed);
      drawStroke(batch.ctx, { brush, points: points.slice(0, i + 1) });
      assert.equal(active.ctx.fillStyle, batch.ctx.fillStyle);
      assert.deepEqual(active.commands, batch.commands);
    }
  }
});
