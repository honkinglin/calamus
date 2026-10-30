import test from 'node:test';
import assert from 'node:assert/strict';
import { hitsStroke, hitsStrokeSweep } from '../dist/hit-test.js';
const stroke = { brush: { color: '#000', size: 10 }, points: [
  { x: 0, y: 0, time: 0, pressure: null },
  { x: 100, y: 0, time: 100, pressure: null },
] };
test('hit test includes segment width and eraser radius', () => {
  assert.equal(hitsStroke(stroke, 50, 14, 10), true);
  assert.equal(hitsStroke(stroke, 50, 16, 10), false);
  assert.equal(hitsStroke(stroke, -16, 0, 10), false);
});
test('single dots and empty strokes are handled', () => {
  assert.equal(hitsStroke({ ...stroke, points: stroke.points.slice(0, 1) }, 0, 0, 10), true);
  assert.equal(hitsStroke({ ...stroke, points: [] }, 0, 0, 10), false);
});

test('fast sweep crosses a stroke even when both samples miss', () => {
  assert.equal(hitsStrokeSweep(stroke, { x: 50, y: -100 }, { x: 50, y: 100 }, 10), true);
  assert.equal(hitsStrokeSweep(stroke, { x: 50, y: 100 }, { x: 50, y: -100 }, 10), true);
});
test('parallel distant sweep and disjoint collinear segments miss', () => {
  assert.equal(hitsStrokeSweep(stroke, { x: -100, y: 30 }, { x: 200, y: 30 }, 10), false);
  assert.equal(hitsStrokeSweep(stroke, { x: 200, y: 0 }, { x: 300, y: 0 }, 10), false);
});

test('cached broad phase agrees with exact geometry across deterministic sweeps', async () => {
  const { StrokeHitCache } = await import('../dist/hit-test.js');
  const cache = new StrokeHitCache();
  const samples = [stroke, { brush: { color: '#000', size: 30, smoothing: 0.55, stabilizer: 12 },
    points: Array.from({ length: 50 }, (_, i) => ({ x: i * 5, y: Math.sin(i) * 60, time: i * 8, pressure: i % 5 / 4 })) },
    { ...stroke, points: [] }, { ...stroke, points: stroke.points.slice(0, 1) }];
  for (const sample of samples) {
    for (let i = 0; i < 160; i++) {
      const start = { x: (i * 31 % 340) - 50, y: (i * 17 % 200) - 100 };
      const end = { x: start.x + (i % 3 - 1) * 110, y: start.y + (i % 5 - 2) * 50 };
      const radius = [0, 1, 10, 30][i % 4];
      assert.equal(cache.hits(sample, start, end, radius), hitsStrokeSweep(sample, start, end, radius));
    }
  }
});
test('distant misses avoid geometry storage and tangencies are not rejected', async () => {
  const { StrokeHitCache } = await import('../dist/hit-test.js');
  const cache = new StrokeHitCache();
  assert.equal(cache.hits(stroke, { x: 500, y: 500 }, { x: 600, y: 600 }, 10), false);
  assert.deepEqual(cache.stats, { entries: 0, vertices: 0 });
  assert.equal(cache.hits(stroke, { x: 50, y: 15 }, { x: 50, y: 15 }, 10), true);
  assert.equal(cache.stats.entries, 1);
  cache.clear();
  assert.deepEqual(cache.stats, { entries: 0, vertices: 0 });
});
test('cache budget eviction and oversized entries preserve exact answers', async () => {
  const { StrokeHitCache } = await import('../dist/hit-test.js');
  for (const cache of [new StrokeHitCache(100, 1), new StrokeHitCache(1, 1)]) {
    for (let index = 0; index < 5; index++) {
      const input = structuredClone(stroke);
      assert.equal(cache.hits(input, { x: 50, y: 0 }, { x: 50, y: 0 }, 0), true);
      assert.ok(cache.stats.entries <= 1);
      assert.ok(cache.stats.vertices <= 100);
    }
  }
});
