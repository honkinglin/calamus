import test from 'node:test';
import assert from 'node:assert/strict';
import { ActiveStrokePath } from '../dist/active-path.js';
const polygons = Array.from({length: 100}, (_, x) => [{x,y:0},{x:x+1,y:0},{x,y:1}]);
function fixture(limit = 100000) {
  const paths = [], fills = [];
  const cache = new ActiveStrokePath(() => {
    const commands = [];
    const path = { commands, moveTo: (...p) => commands.push(['M',...p]), lineTo: (...p) => commands.push(['L',...p]), closePath: () => commands.push(['Z']) };
    paths.push(path); return path;
  }, limit);
  const ctx = {fill: (path, rule) => fills.push({commands: structuredClone(path.commands), rule})};
  return {cache,ctx,paths,fills};
}
test('growing transparent strokes append geometry once and retain one nonzero fill per frame', () => {
  const f=fixture();
  for (const n of [1,20,20,100]) {
    assert.equal(f.cache.draw(f.ctx,'#12345666',polygons.slice(0,n)),true);
    assert.equal(f.paths.length,1);
    assert.equal(f.paths[0].commands.length,n*4);
    assert.equal(f.fills.at(-1).commands.length,n*4);
    assert.equal(f.fills.at(-1).rule,'nonzero');
    assert.equal(f.ctx.fillStyle,'#12345666');
  }
  assert.equal(f.fills.length,4);
});
test('shrinking geometry and disposal reconstruct without stale segments', () => {
  const f=fixture(); f.cache.draw(f.ctx,'#1234',polygons);
  f.cache.draw(f.ctx,'#1234',polygons.slice(0,1));
  assert.equal(f.fills.at(-1).commands.length,4);
  f.cache.dispose(); f.cache.draw(f.ctx,'#1234',polygons.slice(0,2));
  assert.equal(f.paths.length,3); assert.equal(f.fills.at(-1).commands.length,8);
});
test('vertex budget uses fallback until disposal and missing Path2D is supported', () => {
  const f=fixture(3);
  assert.equal(f.cache.draw(f.ctx,'#1234',polygons.slice(0,1)),true);
  assert.equal(f.cache.draw(f.ctx,'#1234',polygons),false);
  assert.equal(f.cache.draw(f.ctx,'#1234',polygons.slice(0,1)),false);
  f.cache.dispose(); assert.equal(f.cache.draw(f.ctx,'#1234',polygons.slice(0,1)),true);
  assert.equal(new ActiveStrokePath().draw(f.ctx,'#1234',polygons),false);
});
