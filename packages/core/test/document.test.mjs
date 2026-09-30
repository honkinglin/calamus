import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDocument } from '../dist/index.js';
const document = () => ({
  schemaVersion: 1, width: 1000, height: 700,
  strokes: [{ brush: { color: '#123456', size: 4 }, points: [{ x: 0, y: 0, time: 0, pressure: null }] }],
});
test('minimal legacy brush receives compatible defaults', () => {
  const result = parseDocument(JSON.stringify(document()));
  assert.equal(result.strokes[0].brush.smoothing, 0);
  assert.equal(result.strokes[0].points[0].pressure, null);
});
test('rejects unsupported version and invalid geometry', () => {
  const data = document();
  data.schemaVersion = 2;
  assert.throws(() => parseDocument(JSON.stringify(data)), /version/);
  data.schemaVersion = 1;
  data.strokes[0].points[0].x = null;
  assert.throws(() => parseDocument(JSON.stringify(data)), /numeric/);
});
test('rejects decreasing timestamps', () => {
  const data = document();
  data.strokes[0].points.push({ x: 2, y: 0, time: -1, pressure: 0 });
  assert.throws(() => parseDocument(JSON.stringify(data)));
});
