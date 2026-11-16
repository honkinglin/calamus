import test from 'node:test';
import assert from 'node:assert/strict';
import { filterDrawings } from '../src/library.ts';
const drawings = [
  {id:'a',name:'Spring Sketch',json:'{}',updatedAt:1},
  {id:'b',name:'春日 🎨',json:'{}',updatedAt:2},
  {id:'c',name:'ＳＰＲＩＮＧ study',json:'{}',updatedAt:3},
];
test('search matches case, Unicode width and Chinese names', () => {
  assert.deepEqual(filterDrawings(drawings, '  spring  ').map(d => d.id), ['a','c']);
  assert.deepEqual(filterDrawings(drawings, '春日').map(d => d.id), ['b']);
  assert.deepEqual(filterDrawings(drawings, '🎨').map(d => d.id), ['b']);
  assert.deepEqual(filterDrawings(drawings, 'missing'), []);
});
test('clearing search restores stable order without mutating source', () => {
  const before = structuredClone(drawings);
  assert.deepEqual(filterDrawings(drawings, '  '), before);
  filterDrawings(drawings, 'study');
  assert.deepEqual(drawings, before);
  assert.notEqual(filterDrawings(drawings, ''), drawings);
});
