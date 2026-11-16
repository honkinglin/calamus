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
