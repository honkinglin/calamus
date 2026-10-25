import test from 'node:test';
import assert from 'node:assert/strict';
import { clampZoom, zoomScroll } from '../src/viewport.ts';

test('zoom has bounded finite limits', () => {
  assert.equal(clampZoom(0.5), 1);
  assert.equal(clampZoom(4), 3);
  assert.equal(clampZoom(NaN), 1);
  assert.equal(clampZoom(1.75), 1.75);
});
test('zoom preserves the document point at the viewport center', () => {
  const before = (150 + 400 / 2) / 1.5;
  const after = zoomScroll(150, 400, 1.5, 2);
  assert.equal((after + 400 / 2) / 2, before);
});
test('zoom round trip restores scroll and never returns negative offsets', () => {
  assert.equal(zoomScroll(zoomScroll(100, 500, 1.5, 3), 500, 3, 1.5), 100);
  assert.equal(zoomScroll(0, 500, 3, 1), 0);
});
