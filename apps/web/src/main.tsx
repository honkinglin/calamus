import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Calamus, drawStroke, PAPER } from '@calamus/core';
import type { Stroke } from '@calamus/core';
import './style.css';

const palette = ['#253631', '#477c6c', '#b85c4c', '#ba8c46', '#5f6aab'];

function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Calamus | null>(null);
  const history = useRef<{ past: Stroke[][]; future: Stroke[][]; strokes: Stroke[] }>({
    past: [], future: [], strokes: [],
  });
  const [color, setColor] = useState(palette[0]);
  const [size, setSize] = useState(6);
  const [smoothing, setSmoothing] = useState(0.55);
  const [stabilizer, setStabilizer] = useState(0);
  const [velocityWidth, setVelocityWidth] = useState(true);
  const [paper, setPaper] = useState<'plain' | 'dots'>('dots');
  const [counts, setCounts] = useState({ strokes: 0, undo: 0, redo: 0 });

  useEffect(() => {
    if (!canvas.current) return;
    const board = new Calamus(canvas.current, {
      onStroke: stroke => commit([...history.current.strokes, stroke]),
    });
    engine.current = board;
    return () => board.destroy();
  }, []);

  useEffect(() => {
    engine.current?.setBrush({ color, size, smoothing, stabilizer, velocityWidth });
  }, [color, size, smoothing, stabilizer, velocityWidth]);

  function update() {
    const { strokes, past, future } = history.current;
    setCounts({ strokes: strokes.length, undo: past.length, redo: future.length });
    engine.current?.setStrokes(strokes);
  }

  function commit(strokes: Stroke[]) {
    const state = history.current;
    state.past.push(state.strokes);
    state.strokes = strokes;
    state.future = [];
    update();
  }

  function step(redo: boolean) {
    const state = history.current;
    const next = (redo ? state.future : state.past).pop();
    if (!next) return;
    (redo ? state.past : state.future).push(state.strokes);
    state.strokes = next;
    update();
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

  function exportImage() {
    const image = document.createElement('canvas');
    image.width = PAPER.width;
    image.height = PAPER.height;
    const ctx = image.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(0, 0, image.width, image.height);
    for (const stroke of history.current.strokes) drawStroke(ctx, stroke);
    const link = document.createElement('a');
    link.download = 'calamus.png';
    link.href = image.toDataURL('image/png');
    link.click();
  }

  return (
    <>
      <header>
        <a className="brand" href="./" aria-label="Calamus home"><span aria-hidden="true">✒</span> Calamus</a>
        <button className="primary" onClick={exportImage}>Export PNG</button>
      </header>
      <main>
        <section className="workspace" aria-label="Drawing workspace">
          <div className="workbar">
            <h1>Untitled drawing</h1>
            <div className="actions">
              <button disabled={!counts.undo} onClick={() => step(false)}>Undo</button>
              <button disabled={!counts.redo} onClick={() => step(true)}>Redo</button>
              <button disabled={!counts.strokes} onClick={() => { commit([]); }}>Clear</button>
            </div>
          </div>
          <div className={'paper ' + paper}>
            <canvas ref={canvas} aria-label="Drawing canvas" />
            {!counts.strokes && <span className="paper-hint">Draw anywhere to begin</span>}
          </div>
          <p className="status">{counts.strokes} {counts.strokes === 1 ? 'stroke' : 'strokes'} <span>1000 × 700 px</span></p>
        </section>
        <aside aria-label="Drawing settings">
          <section>
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
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
