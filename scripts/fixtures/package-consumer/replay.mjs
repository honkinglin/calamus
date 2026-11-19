import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Calamus as ESM } from '@calamus/core';
const { Calamus: UMD } = createRequire(import.meta.url)('@calamus/core/umd');

// Deterministic Canvas command smoke test, not a browser pixel/performance test.
const frames = new Map();
let frameId = 0;
globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
globalThis.window = Object.assign(new EventTarget(), {devicePixelRatio:1,matchMedia:()=>new EventTarget()});
globalThis.PointerEvent = class extends Event {};
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
function tick(time) {
  const batch = [...frames.entries()];
  for (const [id,callback] of batch) {
    if (!frames.has(id)) continue;
    frames.delete(id);callback(time);
  }
}
class Canvas extends EventTarget {
  width=300; height=150; clientWidth=500; clientHeight=350;
  style={touchAction:'auto'};
  commands=[];
  ownerDocument={createElement:()=>new Canvas()};
  context={
    globalAlpha:1,globalCompositeOperation:'source-over',filter:'none',shadowColor:'rgba(0, 0, 0, 0)',
    setTransform(){},clearRect(){},drawImage(){},fillRect(){},
    beginPath:()=>this.commands.push(['begin']),
    moveTo:(x,y)=>this.commands.push(['move',x,y]),
    lineTo:(x,y)=>this.commands.push(['line',x,y]),
    closePath:()=>this.commands.push(['close']),
    fill:rule=>this.commands.push(['fill',this.context.fillStyle,rule]),
  };
  getContext(){return this.context;}
  getBoundingClientRect(){return {left:0,top:0,width:500,height:350};}
}
function verify(Engine) {
  const canvas=new Canvas();
  const states=[];
  const engine=new Engine(canvas,{onReplayChange:state=>states.push(state)});
  try {
    engine.setStrokes(['#25363166','#b85c4c66'].map((color,index)=>({
      brush:{color,size:6,smoothing:0.55},
      points:[0,0.3,20].map((time,i)=>({x:i*10,y:index*10+i*5,time,pressure:null})),
    })));
    const json=engine.exportJSON();
    const history=engine.state;
    engine.play();tick(0);tick(140);tick(140.3);
    assert.ok(canvas.commands.length>0,'replay must submit drawing commands');
    engine.pauseReplay();
    const paused=canvas.commands.length;
    tick(1000);
    assert.equal(canvas.commands.length,paused);
    engine.resumeReplay();tick(2000);tick(2140);
    assert.deepEqual(states,['playing','paused','playing','idle']);
    assert.equal(engine.exportJSON(),json);
    assert.deepEqual(engine.state,history);
    engine.play();tick(3000);engine.stopReplay();
    assert.equal(states.at(-1),'idle');
    assert.equal(frames.size,0,'stop cancels scheduled work');
    const stopped=canvas.commands.length;
    tick(4000);
    assert.equal(canvas.commands.length,stopped);
    engine.play();engine.destroy();
    assert.equal(states.at(-1),'idle');
    assert.equal(frames.size,0,'destroy releases scheduled work');
    assert.equal(canvas.style.touchAction,'auto');
    return {commands:canvas.commands,states,json};
  } finally { engine.destroy(); }
}
assert.deepEqual(verify(UMD),verify(ESM));
console.log('Installed ESM/UMD replay commands, pause/resume, cancellation, document/history preservation and teardown match.');
