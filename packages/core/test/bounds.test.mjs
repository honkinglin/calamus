import test from 'node:test';
import assert from 'node:assert/strict';
import { exportBounds } from '../dist/bounds.js';
import { createSVG } from '../dist/index.js';
const stroke = { brush: { size: 10, color: '#000' }, points: [{ x: 100, y: 100, time: 0, pressure: null }] };
test('crop includes actual brush width and padding', () => {
  const bounds = exportBounds([stroke], 1000, 700, { crop: true, padding: 12 });
  assert.ok(bounds.x <= 83 && bounds.y <= 83);
  assert.ok(bounds.width >= 34 && bounds.height >= 34);
  assert.match(createSVG([stroke], 1000, 700, { crop: true }), new RegExp('viewBox="' + bounds.x + ' ' + bounds.y + ' ' + bounds.width + ' ' + bounds.height + '"'));
});
test('empty and uncropped exports retain document dimensions', () => {
  assert.deepEqual(exportBounds([], 1000, 700, { crop: true }), { x: 0, y: 0, width: 1000, height: 700 });
  assert.equal(exportBounds([stroke], 1000, 700).width, 1000);
  assert.throws(() => exportBounds([], 1, 1, { padding: -1 }), /padding/);
});
