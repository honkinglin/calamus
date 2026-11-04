import test from 'node:test';
import assert from 'node:assert/strict';
import { ActiveStrokeRaster } from '../dist/active-raster.js';
import { drawGeometry } from '../dist/render.js';

function context() {
  let path = [];
  return {
    globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', shadowColor: 'rgba(0, 0, 0, 0)',
    paths: [], transforms: [], submitted: 0,
    setTransform(...values) { this.transforms.push(values); },
    beginPath() { path = []; },
    moveTo(x, y) { this.submitted++; path.push(['M', x, y]); },
    lineTo(x, y) { path.push(['L', x, y]); }, closePath() { path.push(['Z']); },
    fill(rule) { this.paths.push({ path: [...path], rule }); },
    drawImage(canvas) { this.paths.push(...structuredClone(canvas.ctx.paths)); },
  };
}
function surface() {
  let width = 300, height = 150;
  const ctx = context();
  return { ctx, getContext: () => ctx,
    get width() { return width; }, set width(value) { width = value; ctx.paths = []; },
    get height() { return height; }, set height(value) { height = value; ctx.paths = []; },
  };
}
const polygons = Array.from({ length: 300 }, (_, i) => [{ x: i, y: 0 }, { x: i + 1, y: 0 }, { x: i, y: 1 }]);

test('raster prefix preserves ordered batch paths while submitting only newly completed batches', () => {
  const canvas = surface(); const raster = new ActiveStrokeRaster(() => canvas);
  let previous = 0;
  for (const count of [1, 63, 64, 65, 127, 128, 128, 193, 300]) {
    const ctx = context(), expected = context();
    const geometry = polygons.slice(0, count);
    if (!raster.draw(ctx, '#123456', geometry, 500, 350, 1000, 700)) drawGeometry(ctx, '#123456', geometry);
    drawGeometry(expected, '#123456', geometry);
    assert.deepEqual(ctx.paths, expected.paths);
    const complete = Math.floor(count / 64) * 64;
    assert.equal(canvas.ctx.submitted, complete);
    assert.ok(complete >= previous);
    previous = complete;
    if (complete) assert.equal(ctx.submitted, count % 64);
  }
});

test('DPR resize reconstructs the prefix with the new transform', () => {
  const canvas = surface(); const raster = new ActiveStrokeRaster(() => canvas);
  raster.draw(context(), '#123456', polygons, 500, 350, 1000, 700);
  const before = canvas.ctx.submitted;
  raster.draw(context(), '#123456', polygons, 1000, 700, 1000, 700);
  assert.equal(canvas.ctx.submitted - before, 256);
  assert.deepEqual(canvas.ctx.transforms.at(-1), [1, 0, 0, 1, 0, 0]);
  assert.equal(canvas.ctx.paths.length, 4);
});

test('transparent colors and special effects use fallback without allocating a surface', () => {
  const raster = new ActiveStrokeRaster(() => { throw new Error('unexpected allocation'); });
  for (const color of ['#12345666', 'red']) assert.equal(raster.draw(context(), color, polygons, 500, 350, 1000, 700), false);
  for (const overrides of [{ globalAlpha: 0.5 }, { filter: 'blur(2px)' }, { shadowColor: '#000' }, { globalCompositeOperation: 'multiply' }]) {
    assert.equal(raster.draw(Object.assign(context(), overrides), '#123456', polygons, 500, 350, 1000, 700), false);
  }
});

test('pixel budget fallback and disposal release backing storage and permit reconstruction', () => {
  const canvas = surface(); const raster = new ActiveStrokeRaster(() => canvas, 175000);
  assert.equal(raster.draw(context(), '#123456', polygons, 500, 350, 1000, 700), true);
  assert.equal(raster.draw(context(), '#123456', polygons, 501, 350, 1000, 700), false);
  assert.equal(canvas.width, 0); assert.equal(canvas.height, 0);
  assert.equal(raster.draw(context(), '#123456', polygons, 500, 350, 1000, 700), true);
  raster.dispose(); raster.dispose();
  assert.equal(canvas.width, 0);
});

test('missing context falls back and color changes rebuild the prefix', () => {
  const unavailable = surface(); unavailable.getContext = () => null;
  assert.equal(new ActiveStrokeRaster(() => unavailable).draw(context(), '#123456', polygons, 500, 350, 1000, 700), false);
  assert.equal(unavailable.width, 0);
  const canvas = surface(); const raster = new ActiveStrokeRaster(() => canvas);
  raster.draw(context(), '#123456', polygons, 500, 350, 1000, 700);
  raster.draw(context(), '#abcdef', polygons, 500, 350, 1000, 700);
  assert.equal(canvas.ctx.fillStyle, '#abcdef');
  assert.equal(canvas.ctx.paths.length, 4);
});
