import test from 'node:test';
import assert from 'node:assert/strict';
import { processStroke, createStrokeGeometry } from '../dist/index.js';

const point = (x, time, pressure = null) => ({ x, y: 0, time, pressure });
const stroke = (points, brush = {}) => ({ points, brush: { color: '#000', size: 10, ...brush } });

test('legacy points keep exact coordinates and constant width', () => {
  const points = [point(0, 0), point(10, 10)];
  assert.deepEqual(processStroke(stroke(points)), points.map(value => ({ ...value, width: 10 })));
});
test('zero pressure remains distinct from missing pressure', () => {
  assert.equal(processStroke(stroke([point(0, 0, 0)]))[0].width, 4);
  assert.equal(processStroke(stroke([point(0, 0)]))[0].width, 10);
});
test('processing is deterministic and leaves input unchanged', () => {
  const input = stroke([point(0, 0), point(10, 10), point(50, 20)], { smoothing: 0.6, velocityWidth: true });
  const copy = structuredClone(input);
  assert.deepEqual(processStroke(input), processStroke(input));
  assert.deepEqual(input, copy);
});
test('stabilizer preserves short gestures and reduces pointer movement', () => {
  const result = processStroke(stroke([point(0, 0), point(5, 10), point(20, 20)], { stabilizer: 10 }));
  assert.equal(result[0].x, 0);
  assert.ok(result[1].x > 0 && result[1].x < 5);
  assert.ok(result[2].x > result[1].x && result[2].x < 20);
});
test('faster movement produces thinner simulated strokes', () => {
  const slow = processStroke(stroke([point(0, 0), point(100, 1000)], { velocityWidth: true }));
  const fast = processStroke(stroke([point(0, 0), point(100, 10)], { velocityWidth: true }));
  assert.ok(fast[1].width < slow[1].width);
});

test('geometry handles dots, duplicate samples and sharp reversals', () => {
  for (const points of [[point(0, 0)], [point(0, 0), point(0, 1)], [point(0, 0), point(10, 1), point(-10, 2)]]) {
    const polygons = createStrokeGeometry(stroke(points));
    assert.ok(polygons.length > 0);
    for (const polygon of polygons) {
      assert.ok(polygon.every(vertex => Number.isFinite(vertex.x) && Number.isFinite(vertex.y)));
      const area = polygon.reduce((sum, vertex, i) => {
        const next = polygon[(i + 1) % polygon.length];
        return sum + vertex.x * next.y - next.x * vertex.y;
      }, 0);
      assert.ok(area > 0, 'all subpaths must share winding');
    }
  }
});
test('empty strokes produce empty geometry', () => {
  assert.deepEqual(createStrokeGeometry(stroke([])), []);
});
