import test from 'node:test';
import assert from 'node:assert/strict';
import { replayFrame, replayDuration, createReplayTimeline } from '../dist/replay.js';
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

test('binary replay boundary includes all tied timestamps and respects inter-stroke gaps', () => {
  const timed = times => ({...stroke, points:times.map(time => ({x:time,y:0,pressure:null,time}))});
  const source = [timed([0,0,20,20,100]), timed([0,30,30,60])];
  const before = structuredClone(source);
  const reference = elapsed => {
    const result = [];
    let remaining = Math.max(0, elapsed);
    for (const item of source) {
      const duration = item.points.at(-1).time;
      if (remaining >= duration) result.push(item);
      else {
        const points = item.points.filter(point => point.time <= remaining);
        if (points.length) result.push({...item,points});
        break;
      }
      remaining -= duration + 120;
      if (remaining < 0) break;
    }
    return result;
  };
  for (let elapsed = -1; elapsed <= replayDuration(source) + 1; elapsed++) {
    assert.deepEqual(replayFrame(source, elapsed), reference(elapsed));
  }
  assert.deepEqual(source, before);
});
test('early replay does not scan a large unrevealed sample tail', () => {
  let reads = 0;
  const points = Array.from({length:100_000}, (_, time) => ({
    x:time, y:0, pressure:null,
    get time() { reads++; return time; },
  }));
  const frame = replayFrame([{...stroke, points}], 2);
  assert.equal(frame[0].points.length, 3);
  assert.equal(frame[0].points[2], points[2]);
  assert.ok(reads < 25, `expected logarithmic timestamp reads, got ${reads}`);
});

test('indexed timeline matches sequential frames across pauses, ties and backwards seeks', () => {
  const source = [0, 30, 0, 140].map(duration => ({...stroke,
    points:[0,0,duration,duration].map(time => ({x:time,y:0,time,pressure:null})),
  }));
  const timeline = createReplayTimeline(source);
  assert.equal(timeline.duration, replayDuration(source));
  for (let time = timeline.duration + 1; time >= -1; time--) {
    assert.deepEqual(timeline.frame(time), replayFrame(source,time));
  }
  assert.deepEqual(createReplayTimeline([]).frame(0), []);
  assert.equal(createReplayTimeline([]).duration, 0);
});
test('indexed frames do not reread completed stroke timestamps', () => {
  let reads = 0;
  const source = Array.from({length:10_000}, () => ({...stroke,points:[{
    x:0,y:0,pressure:null,get time() { reads++; return 0; },
  }]}));
  const timeline = createReplayTimeline(source);
  reads = 0;
  assert.equal(timeline.frame(9999 * 120).length, 10_000);
  assert.equal(reads, 0);
  source.pop();
  assert.equal(timeline.frame(timeline.duration).length, 10_000, 'session owns its list snapshot');
});
