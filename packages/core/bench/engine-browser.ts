import { nextFrame } from './next-frame';
import { Calamus } from '../src/engine';

let canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const readback = document.querySelector<HTMLInputElement>('#readback')!;
const run = document.querySelector<HTMLButtonElement>('#run')!;
const download = document.querySelector<HTMLButtonElement>('#download')!;
const status = document.querySelector<HTMLElement>('#status')!;
const output = document.querySelector<HTMLElement>('#report')!;
let report = '';

const cancel = document.querySelector<HTMLButtonElement>('#cancel')!;
let task: AbortController | undefined;
cancel.onclick = () => task?.abort();
document.addEventListener('visibilitychange', () => { if (document.hidden) task?.abort(); });
window.addEventListener('pagehide', () => task?.abort());
const pixels = () => canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
function difference(a: Uint8ClampedArray,b: Uint8ClampedArray) {
  if(a.length!==b.length) throw new Error('Canvas dimensions changed during checks.');
  let changedPixels=0,maxChannelDelta=0,changedRGBPixels=0,changedAlphaPixels=0,maxAlphaDelta=0;
  for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<4;c++){const delta=Math.abs(a[i+c]-b[i+c]);changed ||= delta!==0;maxChannelDelta=Math.max(maxChannelDelta,delta);}if(changed)changedPixels++;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])changedRGBPixels++;const alpha=Math.abs(a[i+3]-b[i+3]);if(alpha)changedAlphaPixels++;maxAlphaDelta=Math.max(maxAlphaDelta,alpha);}
  return {changedPixels,maxChannelDelta,changedRGBPixels,changedAlphaPixels,maxAlphaDelta};
}
run.onclick=async()=>{
  if (task) return;
  const controller = new AbortController(); task = controller; cancel.disabled = false;
  const frame = () => nextFrame(controller.signal);

  run.disabled=download.disabled=readback.disabled=true;output.textContent='';report='';
  const readbackContext=readback.checked;
  const fresh=canvas.cloneNode(false) as HTMLCanvasElement;canvas.replaceWith(fresh);canvas=fresh;
  if(readbackContext) canvas.getContext('2d',{willReadFrequently:true});
  let board:Calamus|undefined;
  const states:string[]=[];
  try {
    board=new Calamus(canvas,{width:1000,height:700,onReplayChange:state=>states.push(state)});
    const strokes=['#254e4366','#b85c4c66'].map((color,index)=>({brush:{color,size:20,smoothing:0.55,velocityWidth:false},points:Array.from({length:500},(_,i)=>({x:100+i/499*800,y:350+Math.sin(i/25+index)*220,time:i*2,pressure:null}))}));
    board.loadJSON(JSON.stringify({schemaVersion:1,width:1000,height:700,strokes}),{resetHistory:true});
    await frame();const baseline=pixels();const json=board.exportJSON();
    const rows: ({name:string}&ReturnType<typeof difference>)[]=[];
    rows.push({name:'repeat read without redraw',...difference(baseline,pixels())});
    const compare=(name:string)=>rows.push({name,...difference(baseline,pixels())});
    status.textContent='Checking JSON and history…';
    board.clear();board.undo();await frame();compare('clear / undo');
    board.redo();board.undo();await frame();compare('redo / undo');
    board.loadJSON(json,{resetHistory:true});await frame();compare('JSON round trip');
    const jsonUnchanged=board.exportJSON()===json;
    status.textContent='Checking PNG export…';
    const bitmap=await createImageBitmap(await board.exportPNG({scale:1}));
    try {
      const reference=document.createElement('canvas');reference.width=1000;reference.height=700;
      const ctx=reference.getContext('2d',readbackContext?{willReadFrequently:true}:undefined)!;
      // Compare both at the same logical-resolution raster, independently of display DPR.
      const exportBoard=new Calamus(reference,{width:1000,height:700});
      try {
        exportBoard.loadJSON(json,{resetHistory:true});
        const expected=await createImageBitmap(await exportBoard.exportPNG({scale:1}));
        try {reference.width=1000;reference.height=700;ctx.drawImage(expected,0,0);const a=ctx.getImageData(0,0,1000,700).data;ctx.clearRect(0,0,1000,700);ctx.drawImage(bitmap,0,0);rows.push({name:'PNG round trip',...difference(a,ctx.getImageData(0,0,1000,700).data)});}finally{expected.close();}
      }finally{exportBoard.destroy();reference.width=reference.height=0;}
    }finally{bitmap.close();}
    status.textContent='Checking replay pause and resume…';
    board.play({speed:4});await frame();board.pauseReplay();const paused=pixels();await frame();
    const pauseStable=difference(paused,pixels()).changedPixels===0;
    board.resumeReplay();const deadline=performance.now()+10000;
    while(states.at(-1)!=='idle'){if(performance.now()>deadline)throw new Error('Replay timed out.');await frame();}
    compare('replay completion');
    board.play({speed:4});await frame();board.stopReplay();await frame();compare('replay cancellation');
    if(controller.signal.aborted) throw new Error('Measurement cancelled.');
    const documentUnchanged=board.exportJSON()===json;
    const passed=jsonUnchanged&&documentUnchanged&&pauseStable&&rows.every(row=>row.changedPixels===0);
    report=JSON.stringify({schemaVersion:2,readbackContext,recordedAt:new Date().toISOString(),userAgent:navigator.userAgent,devicePixelRatio,canvasWidth:canvas.width,canvasHeight:canvas.height,passed,jsonUnchanged,documentUnchanged,pauseStable,states,rows,notes:'Synthetic 2 x 500 point transparent crossing strokes. Public SDK API; no live pointer input, native memory or frame latency measurement. PNG check compares exported raster before/after document round trip.'},null,2);
    output.textContent=report;download.disabled=false;status.textContent=passed?'Passed: engine checks match.':'Differences detected; inspect report.';
  }catch(error){status.textContent=error instanceof Error?error.message:String(error);}finally{board?.destroy();task=undefined;cancel.disabled=true;run.disabled=readback.disabled=false;}
};
download.onclick=()=>{const url=URL.createObjectURL(new Blob([report],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='calamus-engine-checks.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
