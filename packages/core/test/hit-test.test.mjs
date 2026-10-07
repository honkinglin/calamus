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
