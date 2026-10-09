import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Calamus } from '@calamus/core';
import type { ReplayState } from '@calamus/core';
import { readDrawing, writeDrawing } from './storage';
import './style.css';

const palette = ['#253631', '#477c6c', '#b85c4c', '#ba8c46', '#5f6aab'];

function App() {
  const [cropExport, setCropExport] = useState(false);
  const [exportPadding, setExportPadding] = useState(12);
  const [transparentPNG, setTransparentPNG] = useState(false);
  const [exportScale, setExportScale] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Restoring drawing…');
  const [replayState, setReplayState] = useState<ReplayState>('idle');
  const [replaySpeed, setReplaySpeed] = useState(1);
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileMessage, setFileMessage] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Calamus | null>(null);
  const [color, setColor] = useState(palette[0]);
  const [size, setSize] = useState(6);
  const [smoothing, setSmoothing] = useState(0.55);
  const [stabilizer, setStabilizer] = useState(0);
  const [velocityWidth, setVelocityWidth] = useState(true);
  const [paper, setPaper] = useState<'plain' | 'dots'>('dots');
  const [counts, setCounts] = useState({ strokes: 0, undo: 0, redo: 0 });

  useEffect(() => {
    if (!canvas.current) return;
    let disposed = false;
    let restoring = true;
    let savingEnabled = false;
    let revision = 0;
    let writes = Promise.resolve();
    const board = new Calamus(canvas.current, {
      onChange: state => {
        setCounts(state);
        if (restoring || !savingEnabled) return;
        const json = board.exportJSON();
        const currentRevision = ++revision;
        setSaveStatus('Saving…');
        writes = writes.catch(() => {}).then(() => writeDrawing(json)).then(() => {
          if (!disposed && currentRevision === revision) setSaveStatus('Saved on this device');
        }).catch(() => {
          if (!disposed && currentRevision === revision) setSaveStatus('Could not save. Export JSON to keep your drawing.');
        });
      },
      onReplayChange: setReplayState,
    });
    engine.current = board;
    void readDrawing().then(json => {
      if (disposed) return;
      if (json !== undefined) board.loadJSON(json);
      savingEnabled = true;
      setSaveStatus(json === undefined ? 'Ready to save on this device' : 'Restored from this device');
    }).catch(() => {
      if (!disposed) setSaveStatus('Recovery failed. Automatic saving is disabled; export JSON to keep changes.');
    }).finally(() => {
      if (disposed) return;
      restoring = false;
      setReady(true);
    });
    return () => {
      disposed = true;
      board.destroy();
    };
  }, []);

  useEffect(() => {
    engine.current?.setBrush({ color, size, smoothing, stabilizer, velocityWidth });
  }, [color, size, smoothing, stabilizer, velocityWidth]);

  useEffect(() => { engine.current?.setTool(tool); }, [tool]);

  function step(redo: boolean) {
    if (redo) engine.current?.redo();
    else engine.current?.undo();
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'z') return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      step(event.shiftKey);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function exportVector() {
    const svg = engine.current?.exportSVG({ crop: cropExport, padding: exportPadding });
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'calamus.svg';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportDocument() {
    const json = engine.current?.exportJSON();
    if (!json) return;
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'calamus.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importDocument(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 20_000_000) throw new Error('Document exceeds 20 MB.');
      const content = await file.text();
      engine.current?.loadJSON(content);
      setFileMessage('Drawing imported. Use Undo to restore your previous drawing.');
    } catch (error) {
      setFileMessage(error instanceof Error ? error.message : 'Unable to import drawing.');
    }
  }

  async function exportImage() {
    if (!engine.current || exporting) return;
    setExporting(true);
    try {
      const blob = await engine.current.exportPNG({
        scale: exportScale,
        crop: cropExport,
        padding: exportPadding,
        background: transparentPNG ? undefined : '#fffdf7',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'calamus.png';
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFileMessage('PNG export ready.');
    } catch (error) {
      setFileMessage(error instanceof Error ? error.message : 'Unable to export PNG.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div inert={!ready}>
      <header>
        <a className="brand" href="./" aria-label="Calamus home"><span aria-hidden="true">✒</span> Calamus</a>
        <div className="actions">
          <input ref={fileInput} type="file" accept=".json,application/json" hidden
            onChange={event => { void importDocument(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
          <button onClick={() => fileInput.current?.click()}>Import JSON</button>
          <button onClick={exportDocument}>Export JSON</button>
          <button onClick={exportVector}>Export SVG</button>
          <button className="primary" disabled={exporting} onClick={() => void exportImage()}>{exporting ? 'Exporting…' : 'Export PNG'}</button>
        </div>
      </header>
      <main>
        <section className="workspace" aria-label="Drawing workspace">
          <div className="workbar">
            <h1>Untitled drawing</h1>
            <div className="actions">
              <button disabled={!counts.undo} onClick={() => step(false)}>Undo</button>
              <button disabled={!counts.redo} onClick={() => step(true)}>Redo</button>
              <button disabled={!counts.strokes} onClick={() => engine.current?.clear()}>Clear</button>
            </div>
          </div>
          <p role="status">{fileMessage}</p>
          <div className={'paper ' + paper}>
            <canvas ref={canvas} aria-label="Drawing canvas" />
            {!counts.strokes && <span className="paper-hint">Draw anywhere to begin</span>}
          </div>
          <p className="status">{counts.strokes} {counts.strokes === 1 ? 'stroke' : 'strokes'} <span>1000 × 700 px</span></p>
        </section>
        <aside aria-label="Drawing settings">
          <section>
            <h2>Tool</h2>
            <div className="actions">
              <button aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}>Pen</button>
              <button aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>Eraser</button>
            </div>
            {tool === 'eraser' && <p>Touch a stroke to erase it. Undo restores the whole gesture.</p>}
            {tool === 'pen' && <>
            <h2>Brush</h2>
            <div className="swatches" role="group" aria-label="Brush color">
              {palette.map(value => <button key={value} className="swatch" style={{ background: value }}
                aria-label={'Color ' + value} aria-pressed={color === value} onClick={() => setColor(value)} />)}
            </div>
            <label>Size <output>{size} px</output><input type="range" min="1" max="48" value={size}
              onChange={event => setSize(Number(event.currentTarget.value))} /></label>
            <label>Smoothing <output>{Math.round(smoothing * 100)}%</output>
              <input type="range" min="0" max="1" step="0.05" value={smoothing}
                onChange={event => setSmoothing(Number(event.currentTarget.value))} />
            </label>
            <label>Stabilizer <output>{stabilizer} px</output>
              <input type="range" min="0" max="24" value={stabilizer}
                onChange={event => setStabilizer(Number(event.currentTarget.value))} />
            </label>
            <label><input type="checkbox" checked={velocityWidth}
              onChange={event => setVelocityWidth(event.currentTarget.checked)} /> Speed-sensitive width</label>
            </>}
          </section>
          <section>
            <h2>Export settings</h2>
            <label><input type="checkbox" checked={cropExport}
              onChange={event => setCropExport(event.currentTarget.checked)} /> Crop to drawing</label>
            <label>Padding <output>{exportPadding} px</output>
              <input type="range" min="0" max="64" disabled={!cropExport} value={exportPadding}
                onChange={event => setExportPadding(Number(event.currentTarget.value))} />
            </label>
            <label><input type="checkbox" checked={transparentPNG}
              onChange={event => setTransparentPNG(event.currentTarget.checked)} /> Transparent background</label>
            <label>Resolution
              <select value={exportScale} onChange={event => setExportScale(Number(event.currentTarget.value))}>
                {[1, 2, 4].map(scale => <option key={scale} value={scale}>{scale}×</option>)}
              </select>
            </label>
          </section>
          <section>
            <h2>Replay</h2>
            <label>Speed
              <select value={replaySpeed} disabled={replayState !== 'idle'}
                onChange={event => setReplaySpeed(Number(event.currentTarget.value))}>
                {[0.5, 1, 2, 4].map(speed => <option key={speed} value={speed}>{speed}×</option>)}
              </select>
            </label>
            <p role="status">{replayState === 'playing' ? 'Playing' : replayState === 'paused' ? 'Paused' : 'Ready'}</p>
            <div className="actions">
              <button disabled={!counts.strokes || replayState !== 'idle'} onClick={() => engine.current?.play({ speed: replaySpeed })}>Play</button>
              <button disabled={replayState !== 'playing'} onClick={() => engine.current?.pauseReplay()}>Pause</button>
              <button disabled={replayState !== 'paused'} onClick={() => engine.current?.resumeReplay()}>Resume</button>
              <button disabled={replayState === 'idle'} onClick={() => engine.current?.stopReplay()}>Stop</button>
            </div>
          </section>
          <section>
            <h2>Paper</h2>
            <div className="actions" role="group" aria-label="Paper guides">
              <button aria-pressed={paper === 'plain'} onClick={() => setPaper('plain')}>Plain</button>
              <button aria-pressed={paper === 'dots'} onClick={() => setPaper('dots')}>Dot grid</button>
            </div>
          </section>
        </aside>
      </main>
      </div>
      <p className="save-status" role="status">{saveStatus}</p>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
