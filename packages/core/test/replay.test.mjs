import test from 'node:test';
import assert from 'node:assert/strict';
import { replayFrame, replayDuration } from '../dist/replay.js';
const stroke = {
  brush: { color: '#000', size: 4 },
  points: [0, 50, 100].map(time => ({ x: time, y: 0, pressure: null, time })),
};
test('replay reveals samples and preserves source data', () => {
  const source = [stroke, structuredClone(stroke)];
  const before = structuredClone(source);
  assert.equal(replayFrame(source, 60)[0].points.length, 2);
  assert.equal(replayFrame(source, 150).length, 1);
  assert.equal(replayFrame(source, 280)[1].points.length, 2);
  assert.deepEqual(replayFrame(source, replayDuration(source)), source);
  assert.deepEqual(source, before);
});
test('empty replay has zero duration', () => {
  assert.equal(replayDuration([]), 0);
  assert.deepEqual(replayFrame([], 100), []);
});
