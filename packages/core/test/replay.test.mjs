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

test('corner replay emits the same canvas commands as live sample prefixes', async () => {
  const { drawStroke } = await import('../dist/index.js');
  const commands = value => {
    const output = [];
    const context = {
      set fillStyle(color) { output.push(['color', color]); },
      beginPath() { output.push(['begin']); },
      moveTo(x, y) { output.push(['move', x, y]); },
      lineTo(x, y) { output.push(['line', x, y]); },
      closePath() { output.push(['close']); },
      fill(rule) { output.push(['fill', rule]); },
    };
    drawStroke(context, value);
    return output;
  };
  for (const smoothing of [0, 0.55, 1]) {
    for (const stabilizer of [0, 12, 24]) {
      const corner = {
        brush: { color: '#253631', size: 6, smoothing, stabilizer },
        points: [
          { x: 0, y: 0, time: 0, pressure: null },
          { x: 100, y: 0, time: 20, pressure: null },
          { x: 100, y: 100, time: 40, pressure: null },
          { x: 0, y: 100, time: 60, pressure: null },
        ],
      };
      for (let index = 0; index < corner.points.length; index++) {
        const live = { ...corner, points: corner.points.slice(0, index + 1) };
        const replay = replayFrame([corner], corner.points[index].time)[0];
        assert.deepEqual(commands(live), commands(replay));
      }
    }
  }
});
