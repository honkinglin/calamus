import test from 'node:test';
import assert from 'node:assert/strict';
import { ReplayRenderer } from '../dist/replay-render.js';
import { drawStroke } from '../dist/render.js';
const stroke = color => ({brush:{color,size:6,smoothing:0.55},points:[
  {x:0,y:0,time:0,pressure:null},{x:30,y:20,time:10,pressure:0.4},{x:0,y:0,time:20,pressure:0.8},
]});
function capture(run) {
  const commands=[];
  const ctx={globalAlpha:1,globalCompositeOperation:'source-over',filter:'none',shadowColor:'rgba(0, 0, 0, 0)',
    set fillStyle(value){commands.push(['color',value]);}};
  for(const name of ['beginPath','moveTo','lineTo','closePath','fill'])ctx[name]=(...args)=>commands.push([name,...args]);
  run(ctx);
  return commands;
}
test('cached replay retains opaque and transparent drawing commands and order',()=>{
  const source=[stroke('#253631'),stroke('#b85c4c66')];
  const partial={...source[1],points:source[1].points.slice(0,2)};
  for(const budget of [0,1,100,100000]) {
    const renderer=new ReplayRenderer(budget);
    for(const visible of [[source[0],partial],source,source]) {
      assert.deepEqual(capture(ctx=>renderer.draw(ctx,visible,source)),capture(ctx=>visible.forEach(s=>drawStroke(ctx,s))));
    }
  }
});
test('completed geometry is reused while partial snapshots are recomputed',()=>{
  let reads=0;
  const full=stroke('#25363166');
  full.points=full.points.map(point=>({...point,get x(){reads++;return point.x;}}));
  const renderer=new ReplayRenderer();
  capture(ctx=>renderer.draw(ctx,[full],[full]));
  assert.ok(reads>0);
  reads=0;
  capture(ctx=>renderer.draw(ctx,[full],[full]));
  assert.equal(reads,0);
  const partial={...full,points:full.points.slice(0,1)};
  capture(ctx=>renderer.draw(ctx,[partial],[full]));
  assert.ok(reads>0);
});
test('geometry budget applies across all completed strokes and excludes partial frames',()=>{
  const source=Array.from({length:30},()=>stroke('#25363166'));
  const renderer=new ReplayRenderer(100);
  capture(ctx=>renderer.draw(ctx,source,source));
  const retained=[...renderer.cache.values()].filter(Boolean);
  const vertices=retained.flat().reduce((sum,polygon)=>sum+polygon.length,0);
  assert.ok(vertices<=100);
  assert.ok(renderer.cache.size===source.length);
  const size=renderer.cache.size;
  capture(ctx=>renderer.draw(ctx,[{...source[0],points:source[0].points.slice(0,1)}],source));
  assert.equal(renderer.cache.size,size);
});
