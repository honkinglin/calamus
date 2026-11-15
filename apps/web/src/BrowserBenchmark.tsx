import { useEffect, useRef, useState } from 'react';
import { runBrowserBenchmark } from './browser-benchmark';

type Report = Awaited<ReturnType<typeof runBrowserBenchmark>>;
export function BrowserBenchmark() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const task = useRef<AbortController | null>(null);
  const [running, setRunning] = useState(false);
  const [renderer, setRenderer] = useState<'optimized' | 'reference'>('optimized');
  const [message, setMessage] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  useEffect(() => {
    const hide = () => { if (document.hidden) task.current?.abort(); };
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); task.current?.abort(); task.current = null; };
  }, []);
  async function run() {
    if (!canvas.current || task.current) return;
    const controller = new AbortController();
    task.current = controller;
    setRunning(true); setReport(null); setMessage('Measuring fixed scenarios. Keep this tab visible…');
    try {
      const result = await runBrowserBenchmark(canvas.current, controller.signal, name => setMessage(`Measuring ${name}. Keep this tab visible…`), renderer);
      if (task.current === controller) { setReport(result); setMessage('Measurement complete.'); }
    } catch (error) {
      if (task.current === controller) setMessage(error instanceof Error ? error.message : 'Measurement failed.');
    } finally {
      if (task.current === controller) { task.current = null; setRunning(false); }
    }
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    try {
      const link = document.createElement('a'); link.href = url; link.download = 'calamus-benchmark.json'; link.click();
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  return <section className="browser-benchmark" aria-label="Browser performance">
    <h2>Browser performance</h2>
    <p className="benchmark-description">Fixed full redraws on a separate canvas. Measures command submission and animation-frame intervals, not input latency or guaranteed FPS. Opaque batches also tests 10,000 points; the single-path reference is capped at 2,000 points per stroke.</p>
    <div className="benchmark-controls">
    <label className="benchmark-renderer">Renderer <select disabled={running} value={renderer} onChange={event => setRenderer(event.currentTarget.value as typeof renderer)}>
      <option value="optimized">Opaque batches</option><option value="reference">Single-path reference</option>
    </select></label>
    <div className="benchmark-actions">
      <button className="primary" disabled={running} onClick={() => void run()}>Run browser benchmark</button>
      <button disabled={!running} onClick={() => task.current?.abort()}>Cancel benchmark</button>
      <button disabled={!report || running} onClick={download}>Download benchmark JSON</button>
    </div>
    </div>
    <p className="benchmark-status" role="status">{message}</p>
    <canvas ref={canvas} className="benchmark-canvas" aria-label="Benchmark render preview" />
    {report && <>
      <div className="benchmark-table"><table><caption>{report.renderer} · 30 frames after 5 warm-up frames · milliseconds</caption>
        <thead><tr><th>Scenario</th><th>Submit median / P95</th><th>Frame interval median / P95</th></tr></thead>
        <tbody>{report.rows.map(row => <tr key={row.name}><th scope="row">{row.name}</th>
          <td>{row.submissionMs.median.toFixed(2)} / {row.submissionMs.p95.toFixed(2)}</td>
          <td>{row.frameIntervalMs.median.toFixed(2)} / {row.frameIntervalMs.p95.toFixed(2)}</td></tr>)}</tbody>
      </table></div>
      <p className="setting-note">Raster check at 1000 × 700, outside timings: {report.rasterComparison.map(result =>
        `${result.color}: ${result.changedPixels} changed pixels, max alpha delta ${result.maxAlphaDelta}, ${result.missingSolidPixels} missing solid pixels`).join('; ')}. Opaque edge antialiasing can differ; transparent strokes keep a single fill.</p>
      <p className="setting-note">Canvas {report.canvasWidth} × {report.canvasHeight}; one RGBA buffer estimate: {(report.estimatedCanvasRGBABytes / 1048576).toFixed(2)} MiB. Heap estimates {report.rows.every(row => row.heapBefore !== null && row.heapAfter !== null) ? 'included in JSON; whole page, non-standard and not peak memory' : 'unavailable in this browser; null in JSON'}. Raw timing samples and browser details are included in the download.</p>
    </>}
  </section>;
}
