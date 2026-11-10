import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrush, parseDocument } from '../dist/document.js';

test('live brush contract and persisted brush contract agree at supported boundaries', () => {
  for (const color of ['#abc', '#AbC8', '#123456', '#12345600', '#123456ff']) {
    for (const size of [0.01, 4096]) for (const stabilizer of [0, 4096]) {
      const brush = validateBrush({ color, size, stabilizer, smoothing: 1, velocityWidth: false });
      const document = parseDocument(JSON.stringify({ schemaVersion: 1, width: 1, height: 32768,
        strokes: [{ brush, points: [{ x: 0, y: 0, time: 0, pressure: null }] }],
      }));
      assert.deepEqual(document.strokes[0].brush, brush);
    }
  }
});

test('brush validation copies supported settings and rejects non-serializable configurations', () => {
  const input = { color: '#000', size: 6, extra: 'ignored' };
  const result = validateBrush(input);
  assert.equal(result.smoothing, 0);
  assert.equal(result.stabilizer, 0);
  assert.equal('extra' in result, false);
  result.size = 20;
  assert.equal(input.size, 6);
  for (const patch of [{ color: 'rgba(0,0,0,1)' }, { color: null }, { size: Infinity }, { size: -1 },
    { size: 0.009 }, { size: 4096.01 }, { stabilizer: -1 }, { smoothing: 1.01 }, { velocityWidth: 1 }]) {
    assert.throws(() => validateBrush({ ...input, ...patch }));
  }
});
