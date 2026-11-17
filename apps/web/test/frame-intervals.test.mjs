import test from 'node:test';
import assert from 'node:assert/strict';
import { frameIntervals } from '../../../packages/core/bench/frame-intervals.ts';
test('frame report retains raw interval order and computes median and tail',()=>{
  const timestamps=[100,110,140,160,200];
  assert.deepEqual(frameIntervals(timestamps),{count:4,samplesMs:[10,30,20,40],medianMs:25,p95Ms:40,maxMs:40});
  assert.deepEqual(timestamps,[100,110,140,160,200]);
});
test('insufficient frames remain unknown, equal timestamps survive and invalid clocks fail',()=>{
  for(const timestamps of [[],[100]])assert.deepEqual(frameIntervals(timestamps),{count:0,samplesMs:[],medianMs:null,p95Ms:null,maxMs:null});
  assert.equal(frameIntervals([100,100,120,160]).medianMs,20);
  for(const timestamps of [[NaN],[0,Infinity],[2,1]])assert.throws(()=>frameIntervals(timestamps),/monotonic/);
});
