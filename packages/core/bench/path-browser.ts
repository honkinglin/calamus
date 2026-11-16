import { ActiveStrokePath } from '../src/active-path';
import { createStrokeGeometry } from '../src/geometry';
import { drawGeometry } from '../src/render';

const run = document.querySelector<HTMLButtonElement>('#run')!;
const download = document.querySelector<HTMLButtonElement>('#download')!;
const status = document.querySelector<HTMLElement>('#status')!;
const output = document.querySelector<HTMLElement>('#report')!;
const preview = document.querySelector<HTMLCanvasElement>('#preview')!;
let report = '';
const yieldFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
run.onclick = async () => {
  run.disabled = download.disabled = true; report = ''; output.textContent = '';
  try {
    if (typeof Path2D === 'undefined') throw new Error('Path2D unavailable.');
    const rows = [];
    for (const scale of [1, 2]) {
      const a = document.createElement('canvas'), b = document.createElement('canvas');
      a.width = b.width = 1000 * scale; a.height = b.height = 700 * scale;
      const cached = a.getContext('2d')!, reference = b.getContext('2d')!;
      cached.scale(scale, scale); reference.scale(scale, scale);
      const path = new ActiveStrokePath();
      try {
        const geometry = createStrokeGeometry({ brush: {color:'#254e4366',size:12,smoothing:0.55,velocityWidth:false},
          points: Array.from({length:2049}, (_, i) => ({x:500+Math.sin(i/40)*400,y:350+Math.sin(i/23)*280,time:i*4,pressure:null})) });
        let previousCount = 0;
        for (const count of [1, 100, 500, 1000, 2000, 2001, 2017, 2049]) {
          if (document.hidden) throw new Error('Keep this tab visible.');
          status.textContent = `Comparing ${count} points at scale ${scale}…`; await yieldFrame();
          const prefix = geometry.slice(0, count * 2 - 1);
          const cachedSamplesMs: number[] = [], referenceSamplesMs: number[] = [];
          let usedCache = false;
          const drawCached = () => {
            cached.clearRect(0,0,1000,700);
            const start = performance.now();
            usedCache = path.draw(cached,'#254e4366',prefix);
            if (!usedCache) drawGeometry(cached,'#254e4366',prefix);
            return performance.now() - start;
          };
          const drawReference = () => {
            reference.clearRect(0,0,1000,700);
            const start = performance.now();
            drawGeometry(reference,'#254e4366',prefix);
            return performance.now() - start;
          };
          // First draw includes appending the new portion; report separately from warmed redraws.
          const appendSubmitMs = drawCached();
          for (let sample = 0; sample < 12; sample++) {
            await yieldFrame();
            if (document.hidden) throw new Error('Keep this tab visible.');
            let cachedMs: number, referenceMs: number;
            if (sample % 2 === 0) { cachedMs = drawCached(); referenceMs = drawReference(); }
            else { referenceMs = drawReference(); cachedMs = drawCached(); }
            if (sample >= 2) { cachedSamplesMs.push(cachedMs); referenceSamplesMs.push(referenceMs); }
          }
          const readStart=performance.now();
          const actual=cached.getImageData(0,0,a.width,a.height).data;
          const expected=reference.getImageData(0,0,b.width,b.height).data;
          const readbackMs=performance.now()-readStart;
          let changedPixels=0,maxChannelDelta=0;
          for(let i=0;i<actual.length;i+=4){let changed=false;for(let c=0;c<4;c++){const delta=Math.abs(actual[i+c]-expected[i+c]);changed ||= delta!==0;maxChannelDelta=Math.max(maxChannelDelta,delta);}if(changed)changedPixels++;}
          rows.push({scale,points:count,addedPoints:count-previousCount,scenario:count>2000?'small-increment':'bulk-growth',usedCache,changedPixels,maxChannelDelta,appendSubmitMs,cachedSubmitMs:summary(cachedSamplesMs),referenceSubmitMs:summary(referenceSamplesMs),cachedSamplesMs,referenceSamplesMs,readbackMs});
          previousCount = count;
          preview.getContext('2d')!.clearRect(0,0,1000,700);preview.getContext('2d')!.drawImage(a,0,0,1000,700);
        }
      } finally {path.dispose(); a.width=b.width=0; a.height=b.height=0;}
    }
    report=JSON.stringify({schemaVersion:3,warmupPairs:2,measuredPairs:10,recordedAt:new Date().toISOString(),userAgent:navigator.userAgent,rows,
      notes:'Single growing gesture with bulk growth followed by +1/+16/+32 point increments after 2000 points. Geometry is precomputed and excluded. Append timing separated from 10 warmed redraw pairs after 2 warmup pairs; order alternates. Redraw timings are not incremental drawing latency. Diagnostic timings only; no speedup claim. Readback is outside submit timings. Scales are explicit backing-store scales, not a device DPR change. Native path memory not measured.'},null,2);
    output.textContent=report;download.disabled=false;
    status.textContent=rows.every(row=>row.changedPixels===0)?'Passed: all pixel comparisons match.':'Pixel differences detected; inspect report.';
  } catch(error){status.textContent=error instanceof Error?error.message:String(error);} finally{run.disabled=false;}
};
download.onclick=()=>{const url=URL.createObjectURL(new Blob([report],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='calamus-path-cache.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

function summary(samples: number[]) {
  const sorted = [...samples].sort((a,b)=>a-b);
  return {median:(sorted[4]+sorted[5])/2,p95:sorted[9]};
}
