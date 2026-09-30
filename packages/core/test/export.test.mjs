import test from 'node:test';
import assert from 'node:assert/strict';
import { createSVG } from '../dist/index.js';

test('SVG preserves document size and uses one filled path per stroke', () => {
  const stroke = { brush: { color: '#123456', size: 5 }, points: [
    { x: 0, y: 0, time: 0, pressure: null },
    { x: 20, y: 10, time: 10, pressure: null },
  ] };
  const result = createSVG([stroke, stroke], 100, 50);
  assert.match(result, /viewBox="0 0 100 50"/);
  assert.equal((result.match(/<path /g) ?? []).length, 2);
  assert.match(result, /fill-rule="nonzero"/);
  assert.ok(!result.includes('<image'));
});
test('SVG escapes color attributes', () => {
  const result = createSVG([{ brush: { color: '" onload="bad', size: 5 }, points: [] }], 100, 50);
  assert.match(result, /fill="&quot; onload=&quot;bad"/);
});
test('empty SVG is valid and invalid dimensions are rejected', () => {
  assert.ok(createSVG([], 100, 50).endsWith('></svg>'));
  assert.throws(() => createSVG([], NaN, 50), /dimensions/);
});
