import test from 'node:test';
import assert from 'node:assert/strict';
import { StrokeGeometryCache, createGeometryFromPoints } from '../dist/geometry.js';
import { drawGeometry, drawProcessedStroke } from '../dist/render.js';

const points = Array.from({ length: 120 }, (_, i) => ({
  x: Math.floor(i / 2) % 9 * 4, y: Math.floor(i / 2) % 7 * 3,
  width: 1 + i % 32, time: i * 8, pressure: null,
}));

test('incremental geometry preserves every prefix including coincident points and variable widths', () => {
  const cache = new StrokeGeometryCache();
  points.forEach((point, i) => {
    cache.append(point);
    assert.deepEqual(cache.geometry, createGeometryFromPoints(points.slice(0, i + 1)));
    assert.equal(cache.vertexCount, cache.geometry.reduce((n, polygon) => n + polygon.length, 0));
  });
});

test('cache releases all vertices on overflow and remains in batch fallback', () => {
  const firstCount = createGeometryFromPoints([points[0]])[0].length;
  const cache = new StrokeGeometryCache(firstCount);
  cache.append(points[0]);
  assert.equal(cache.vertexCount, firstCount);
  cache.append(points[1]);
  assert.equal(cache.geometry, null);
  assert.equal(cache.vertexCount, 0);
  cache.append(points[2]);
  assert.equal(cache.geometry, null);
  const empty = new StrokeGeometryCache(0);
  empty.append(points[0]);
  assert.equal(empty.geometry, null);
});

test('cache snapshots the previous point and preserves existing polygon objects', () => {
  const cache = new StrokeGeometryCache();
  const input = { ...points[0] };
  cache.append(input);
  const polygon = cache.geometry[0];
  input.x = 999;
  cache.append(points[1]);
  assert.equal(cache.geometry[0], polygon);
  assert.deepEqual(cache.geometry, createGeometryFromPoints(points.slice(0, 2)));
});

test('cached and fallback rendering preserve opaque and transparent fill commands', () => {
  function context() {
    const commands = [];
    const ctx = { globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', shadowColor: 'rgba(0, 0, 0, 0)' };
    for (const method of ['beginPath', 'moveTo', 'lineTo', 'closePath', 'fill']) ctx[method] = (...args) => commands.push([method, ...args]);
    return { ctx, commands };
  }
  for (const limit of [0, 100000]) for (const color of ['#123456', '#12345666']) {
    const cache = new StrokeGeometryCache(limit);
    for (const point of points) cache.append(point);
    const actual = context(); const expected = context();
    if (cache.geometry) drawGeometry(actual.ctx, color, cache.geometry);
    else drawProcessedStroke(actual.ctx, color, points);
    drawProcessedStroke(expected.ctx, color, points);
    assert.deepEqual(actual.commands, expected.commands);
    if (color.length === 9) assert.equal(actual.commands.filter(([name]) => name === 'fill').length, 1);
  }
});
