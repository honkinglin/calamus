import test from 'node:test';
import assert from 'node:assert/strict';
import { hitsStroke } from '../dist/hit-test.js';
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
