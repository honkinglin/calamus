import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFrame } from '../../../packages/core/bench/next-frame.ts';

test('diagnostic frame resolves normally and abort cancels scheduled callbacks', async () => {
  const oldRequest = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame;
  const pending = new Map(); let next = 0;
  globalThis.requestAnimationFrame = callback => {pending.set(++next, callback); return next;};
  globalThis.cancelAnimationFrame = id => pending.delete(id);
  try {
    const controller = new AbortController();
    const wait = nextFrame(controller.signal);
    const callback=pending.get(1); pending.delete(1); callback(); await wait;
    controller.abort(); assert.equal(pending.size,0);
    const cancelled = new AbortController();
    const stopped = nextFrame(cancelled.signal); cancelled.abort();
    await assert.rejects(stopped,/cancelled/);assert.equal(pending.size,0);
    await assert.rejects(nextFrame(cancelled.signal),/cancelled/);assert.equal(pending.size,0);
  } finally {
    if(oldRequest)globalThis.requestAnimationFrame=oldRequest;else delete globalThis.requestAnimationFrame;
    if(oldCancel)globalThis.cancelAnimationFrame=oldCancel;else delete globalThis.cancelAnimationFrame;
  }
});

test('stalled diagnostic frames time out and release abort listeners', async () => {
  const names = ['requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout'];
  const saved = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis,name)]));
  const pending = new Map(), timers = new Map();
  let listeners = 0;
  const controller = new AbortController();
  const add = controller.signal.addEventListener.bind(controller.signal);
  const remove = controller.signal.removeEventListener.bind(controller.signal);
  controller.signal.addEventListener = (...args) => {listeners++;return add(...args);};
  controller.signal.removeEventListener = (...args) => {listeners--;return remove(...args);};
  try {
    globalThis.requestAnimationFrame = callback => {pending.set(1,callback);return 1;};
    globalThis.cancelAnimationFrame = id => pending.delete(id);
    globalThis.setTimeout = (callback, delay) => {assert.equal(delay,5000);timers.set(1,callback);return 1;};
    globalThis.clearTimeout = id => timers.delete(id);
    const wait=nextFrame(controller.signal);
    const rejected=assert.rejects(wait,/scheduling stalled/);
    assert.equal(listeners,1);
    timers.get(1)();
    await rejected;
    assert.equal(pending.size,0);assert.equal(timers.size,0);assert.equal(listeners,0);
    controller.abort();assert.equal(listeners,0);
  } finally {
    for(const [name,descriptor] of saved) {
      if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
    }
  }
});
