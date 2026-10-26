import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLabSample } from '../src/lab-samples.ts';
import { processStroke } from '../../../packages/core/dist/index.js';

test('lab samples are deterministic independent copies with bounded coordinates and increasing time', () => {
  for (const kind of ['wave', 'corners', 'pressure']) {
    const points = makeLabSample(kind);
    assert.equal(points.length, 121);
    assert.deepEqual(points, makeLabSample(kind));
    assert.ok(points.every((p, i) => p.x >= 0 && p.x <= 480 && p.y >= 0 && p.y <= 240 && p.time === i * 8));
    points[0].x = -1;
    assert.notEqual(makeLabSample(kind)[0].x, -1);
  }
});
test('pressure sample varies width while mouse sample stays constant without velocity simulation', () => {
  const brush = { color: '#000', size: 10 };
  const pressure = processStroke({ brush, points: makeLabSample('pressure') });
  assert.ok(Math.max(...pressure.map(p => p.width)) - Math.min(...pressure.map(p => p.width)) > 5);
  assert.ok(processStroke({ brush, points: makeLabSample('wave') }).every(p => p.width === 10));
});
test('lab sample prefixes produce the same processed points as full samples', () => {
  const points = makeLabSample('corners');
  for (const settings of [{ smoothing: 0.55, stabilizer: 0 }, { smoothing: 0, stabilizer: 16 }]) {
    const brush = { color: '#000', size: 10, ...settings };
    const full = processStroke({ brush, points });
    assert.deepEqual(processStroke({ brush, points: points.slice(0, 60) }), full.slice(0, 60));
  }
});
