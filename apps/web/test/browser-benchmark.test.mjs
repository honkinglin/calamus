import test from 'node:test';
import assert from 'node:assert/strict';
import { benchmarkStrokes, summarize } from '../src/browser-benchmark.ts';

test('benchmark statistics use median and nearest-rank P95 without mutating samples', () => {
  const values = [4, 1, 3, 2];
  assert.deepEqual(summarize(values), { median: 2.5, p95: 4 });
  assert.deepEqual(values, [4, 1, 3, 2]);
  assert.deepEqual(summarize([3]), { median: 3, p95: 3 });
  assert.throws(() => summarize([]));
  assert.throws(() => summarize([NaN]));
});
test('browser benchmark scenarios are deterministic and remain within document bounds', () => {
  const strokes = benchmarkStrokes(100, 100);
  assert.equal(strokes.length, 100);
  assert.deepEqual(strokes, benchmarkStrokes(100, 100));
  assert.ok(strokes.every(stroke => stroke.points.length === 100 && stroke.points.every(p => p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 700)));
  assert.deepEqual(benchmarkStrokes(0, 0), []);
});

test('cancelling an awaited animation frame releases the scheduled callback', async () => {
  const { runBrowserBenchmark } = await import('../src/browser-benchmark.ts');
  const saved = new Map();
  const install = (name, value) => {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value });
  };
  const pending = new Map();
  let next = 0;
  try {
    install('window', { devicePixelRatio: 1 });
    install('requestAnimationFrame', callback => { pending.set(++next, callback); return next; });
    install('cancelAnimationFrame', id => pending.delete(id));
    const canvas = { getContext: () => ({ setTransform() {}, clearRect() { assert.fail('must not draw after cancellation'); } }) };
    const controller = new AbortController();
    const measurement = runBrowserBenchmark(canvas, controller.signal);
    assert.equal(pending.size, 1);
    controller.abort();
    await assert.rejects(measurement, /cancelled/);
    assert.equal(pending.size, 0);
    await assert.rejects(runBrowserBenchmark(canvas, controller.signal), /cancelled/);
    assert.equal(pending.size, 0);
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
