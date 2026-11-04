import assert from 'node:assert/strict';
import { Calamus, PAPER, processStroke, createStrokeGeometry, createSVG, parseDocument } from '@calamus/core';

assert.equal(typeof globalThis.window, 'undefined');
assert.equal(typeof globalThis.document, 'undefined');
assert.equal(typeof Calamus, 'function');
const stroke = { brush: { color: '#12345666', size: 6, smoothing: 0.5 }, points: [
  { x: 10, y: 20, time: 0, pressure: null },
  { x: 30, y: 40, time: 8, pressure: 0.7 },
] };
assert.equal(processStroke(stroke).length, 2);
assert.equal(createStrokeGeometry(stroke).length, 3);
const document = parseDocument(JSON.stringify({ schemaVersion: 1, ...PAPER, strokes: [stroke] }));
assert.equal(document.strokes.length, 1);
assert.match(createSVG(document.strokes, PAPER.width, PAPER.height), /<path fill="#12345666"/);
assert.throws(() => parseDocument('{"schemaVersion":99}'));
await assert.rejects(import('@calamus/core/engine.js'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
console.log('Packed ESM import, pure APIs, document validation and exports boundary passed without a DOM.');
