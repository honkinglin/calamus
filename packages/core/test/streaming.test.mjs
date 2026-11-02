import test from 'node:test';
import assert from 'node:assert/strict';
import { iterateGeometry, createGeometryFromPoints } from '../dist/geometry.js';
import { drawGeometry, drawStroke } from '../dist/render.js';
import { processStroke } from '../dist/stroke.js';

const stroke = { brush: { color: '#123456', size: 8, smoothing: 0.5, stabilizer: 10 },
  points: Array.from({ length: 200 }, (_, i) => ({ x: i, y: Math.sin(i / 8) * 40, time: i * 8, pressure: null })) };
function context() {
  const commands = [];
  const ctx = { globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', shadowColor: 'rgba(0, 0, 0, 0)' };
  for (const method of ['beginPath', 'moveTo', 'lineTo', 'closePath', 'fill']) ctx[method] = (...args) => commands.push([method, ...args]);
  return { ctx, commands };
}

test('geometry iteration consumes input lazily and can terminate without consuming the stroke', () => {
  let consumed = 0;
  const points = processStroke(stroke);
  function* input() { for (const point of points) { consumed++; yield point; } }
  const geometry = iterateGeometry(input());
  assert.equal(consumed, 0);
  geometry.next();
  assert.equal(consumed, 1);
  geometry.next();
  assert.equal(consumed, 2);
  geometry.next();
  assert.equal(consumed, 2);
  geometry.return();
  assert.equal(consumed, 2);
});

test('streaming stroke rendering matches materialized geometry including transparent colors', () => {
  for (const color of ['#123456', '#12345666']) for (const count of [0, 1, 32, 33, 200]) {
    const input = { brush: { ...stroke.brush, color }, points: stroke.points.slice(0, count) };
    const streamed = context(); const materialized = context();
    drawStroke(streamed.ctx, input);
    drawGeometry(materialized.ctx, color, createGeometryFromPoints(processStroke(input)));
    assert.deepEqual(streamed.commands, materialized.commands);
    if (color.length === 9) assert.equal(streamed.commands.filter(([name]) => name === 'fill').length, 1);
  }
});

test('single-pass geometry batches at exact boundaries without an extra empty fill', () => {
  const polygon = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
  for (const count of [0, 1, 63, 64, 65, 128, 129]) {
    let iterations = 0;
    const polygons = { *[Symbol.iterator]() { assert.equal(++iterations, 1); for (let i = 0; i < count; i++) yield polygon; } };
    const output = context();
    drawGeometry(output.ctx, '#123456', polygons);
    assert.equal(output.commands.filter(([name]) => name === 'fill').length, Math.max(1, Math.ceil(count / 64)));
  }
});
