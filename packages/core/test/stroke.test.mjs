import test from 'node:test';
import assert from 'node:assert/strict';
import { processStroke } from '../dist/index.js';

const point = (x, time, pressure = null) => ({ x, y: 0, time, pressure });
const stroke = (points, brush = {}) => ({ points, brush: { color: '#000', size: 10, ...brush } });

test('legacy points keep exact coordinates and constant width', () => {
  const points = [point(0, 0), point(10, 10)];
  assert.deepEqual(processStroke(stroke(points)), points.map(value => ({ ...value, width: 10 })));
});
test('zero pressure remains distinct from missing pressure', () => {
  assert.equal(processStroke(stroke([point(0, 0, 0)]))[0].width, 4);
  assert.equal(processStroke(stroke([point(0, 0)]))[0].width, 10);
});
test('processing is deterministic and leaves input unchanged', () => {
  const input = stroke([point(0, 0), point(10, 10), point(50, 20)], { smoothing: 0.6, velocityWidth: true });
  const copy = structuredClone(input);
  assert.deepEqual(processStroke(input), processStroke(input));
  assert.deepEqual(input, copy);
});
test('stabilizer retains initial point and follows beyond radius', () => {
  const result = processStroke(stroke([point(0, 0), point(5, 10), point(20, 20)], { stabilizer: 10 }));
  assert.deepEqual(result.map(value => value.x), [0, 0, 10]);
});
test('faster movement produces thinner simulated strokes', () => {
  const slow = processStroke(stroke([point(0, 0), point(100, 1000)], { velocityWidth: true }));
  const fast = processStroke(stroke([point(0, 0), point(100, 10)], { velocityWidth: true }));
  assert.ok(fast[1].width < slow[1].width);
});
