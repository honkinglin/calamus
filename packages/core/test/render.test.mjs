import test from 'node:test';
import assert from 'node:assert/strict';
import { createStrokeGeometry, drawStroke } from '../dist/index.js';

function context(overrides = {}) {
  const paths = []; let path;
  return {
    globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', shadowColor: 'rgba(0, 0, 0, 0)',
    paths,
    beginPath() { path = []; },
    moveTo(x, y) { path.push(['M', x, y]); }, lineTo(x, y) { path.push(['L', x, y]); }, closePath() { path.push(['Z']); },
    fill(rule) { assert.equal(rule, 'nonzero'); paths.push(path); }, ...overrides,
  };
}
const stroke = color => ({ brush: { color, size: 10 }, points: Array.from({ length: 100 }, (_, i) => ({
  x: i, y: Math.sin(i / 8) * 10, time: i * 4, pressure: null,
})) });

test('opaque batching preserves every polygon vertex and fill winding', () => {
  const input = stroke('#123456');
  const ctx = context(); drawStroke(ctx, input);
  assert.ok(ctx.paths.length > 1);
  const expected = createStrokeGeometry(input).flatMap(polygon => [
    ...polygon.map((p, i) => [i ? 'L' : 'M', p.x, p.y]), ['Z'],
  ]);
  assert.deepEqual(ctx.paths.flat(), expected);
  assert.ok(ctx.paths.every(path => path.filter(command => command[0] === 'M').length <= 64));
});
test('transparent colors and caller alpha or effects retain one fill per stroke', () => {
  for (const color of ['#1234', '#12345666', 'rgba(0,0,0,1)', 'red']) {
    const ctx = context(); drawStroke(ctx, stroke(color)); assert.equal(ctx.paths.length, 1);
  }
  for (const overrides of [{ globalAlpha: 0.5 }, { globalCompositeOperation: 'multiply' },
    { filter: 'blur(2px)' }, { shadowColor: '#000000' }]) {
    const ctx = context(overrides); drawStroke(ctx, stroke('#123456')); assert.equal(ctx.paths.length, 1);
  }
});
test('fully opaque hex variants batch and single dots remain one fill', () => {
  for (const color of ['#abc', '#abcf', '#ABCDEF', '#ABCDEFFF']) {
    const ctx = context(); drawStroke(ctx, stroke(color)); assert.ok(ctx.paths.length > 1);
    const dot = stroke(color); dot.points.length = 1;
    const single = context(); drawStroke(single, dot); assert.equal(single.paths.length, 1);
  }
});
