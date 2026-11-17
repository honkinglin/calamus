import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createReplayTimeline, replayFrame } from '../dist/replay.js';

// Integer timestamps isolate lookup cost from differing floating-point semantics.
const scenarios = [
  {name:'single-long', strokes:1, points:100000},
  {name:'many-short', strokes:10000, points:10},
];
const samples = 30;
const warmup = 5;
let checksum = 0;
const rows = [];
const summarize = values => {
  const sorted = [...values].sort((a,b) => a-b);
  return {medianMs:sorted[Math.floor(sorted.length/2)], p95Ms:sorted[Math.ceil(sorted.length*0.95)-1]};
};
for (const scenario of scenarios) {
  const strokes = Array.from({length:scenario.strokes}, () => ({
    brush:{color:'#253631',size:6},
    points:Array.from({length:scenario.points}, (_,i) => ({x:i,y:0,time:i*4,pressure:null})),
  }));
  const start = performance.now();
  const timeline = createReplayTimeline(strokes);
  const setupMs = performance.now()-start;
  for (const fraction of [0.01,0.5,0.99]) {
    const elapsed = Math.floor(timeline.duration*fraction);
    assert.deepEqual(timeline.frame(elapsed), replayFrame(strokes,elapsed));
    const runs = {
      sequential: () => replayFrame(strokes,elapsed),
      indexed: () => timeline.frame(elapsed),
    };
    const timings = {sequential:[],indexed:[]};
    for (let i = -warmup; i < samples; i++) {
      const order = i%2 === 0 ? ['sequential','indexed'] : ['indexed','sequential'];
      for (const name of order) {
        const before = performance.now();
        const frame = runs[name]();
        const duration = performance.now()-before;
        checksum += frame.length + (frame.at(-1)?.points.length ?? 0);
        if (i >= 0) timings[name].push(duration);
      }
    }
    rows.push({...scenario,fraction,setupMs,elapsed,matched:true,
      sequential:summarize(timings.sequential),indexed:summarize(timings.indexed)});
  }
}
console.log(JSON.stringify({schemaVersion:1,node:process.version,platform:process.platform,arch:process.arch,
  samples,warmup,checksum,
  scope:'Node CPU lookup and visible-array allocation only; excludes Canvas, GPU, input latency and browser memory. Setup is a single sample per scenario. No performance threshold.',rows},null,2));
