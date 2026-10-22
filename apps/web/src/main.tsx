import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Calamus, parseDocument } from '@calamus/core';
import type { ReplayState } from '@calamus/core';
import { drawingStore } from './storage';
import { createLibrary } from './library';
import type { Drawing } from './library';
import { createImportController } from './import-controller';
import './style.css';

const emptyDocument = JSON.stringify({ schemaVersion: 1, width: 1000, height: 700, strokes: [] });

const palette = ['#253631', '#477c6c', '#b85c4c', '#ba8c46', '#5f6aab'];

function App() {
  const documentRevision = useRef(0);
  const library = useRef<ReturnType<typeof createLibrary> | null>(null);
  const changingDrawing = useRef(false);
  const loadingDocument = useRef(false);
  const libraryDialog = useRef<HTMLDialogElement>(null);
  const libraryButton = useRef<HTMLButtonElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [activeDrawing, setActiveDrawing] = useState<Drawing | null>(null);
  const [drawingName, setDrawingName] = useState('');
  const [libraryMessage, setLibraryMessage] = useState('');
  useEffect(() => {
    if (libraryOpen) libraryDialog.current?.showModal();
    else libraryDialog.current?.close();
  }, [libraryOpen]);
  const importer = useRef<ReturnType<typeof createImportController> | null>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 720px)').matches);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 720px)');
    const update = () => { setMobile(query.matches); setSettingsOpen(false); };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const dialog = panel.current;
    if (!dialog) return;
    dialog.close();
    if (!mobile) dialog.show();
    else if (settingsOpen) dialog.showModal();
  }, [mobile, settingsOpen]);

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
    const collection = createLibrary(drawingStore);
    library.current = collection;
    const board = new Calamus(canvas.current, {
      onChange: state => {
        documentRevision.current++;
        setCounts(state);
        if (restoring || loadingDocument.current || !savingEnabled) return;
        const json = board.exportJSON();
        const currentRevision = ++revision;
        setSaveStatus('Saving…');
        void collection.save(json).then(() => {
          if (!disposed && currentRevision === revision) setSaveStatus('Saved on this device');
        }).catch(() => {
          if (!disposed && currentRevision === revision) setSaveStatus('Could not save. Export JSON to keep your drawing.');
        });
      },
      onReplayChange: setReplayState,
    });
    engine.current = board;
    const imports = createImportController({
      revision: () => documentRevision.current,
      load: json => board.loadJSON(json),
      notify: setFileMessage,
    });
    importer.current = imports;
    void collection.restore(emptyDocument).then(drawing => {
      if (disposed) return;
      board.loadJSON(drawing.json, { resetHistory: true });
      setActiveDrawing(drawing);
      setDrawingName(drawing.name);
      setDrawings(collection.list());
      savingEnabled = true;
      setSaveStatus('Restored from this device');
    }).catch(() => {
      if (!disposed) setSaveStatus('Recovery failed. Automatic saving is disabled; export JSON to keep changes.');
    }).finally(() => {
      if (disposed) return;
      restoring = false;
      setReady(true);
    });
    return () => {
      disposed = true;
      imports.dispose();
      importer.current = null;
      library.current = null;
      engine.current = null;
      board.destroy();
    };
  }, []);

  useEffect(() => {
    engine.current?.setBrush({ color, size, smoothing, stabilizer, velocityWidth });
  }, [color, size, smoothing, stabilizer, velocityWidth]);

  useEffect(() => { engine.current?.setTool(tool); }, [tool]);

  async function changeDrawing(action: 'create' | 'open' | 'rename', id?: string) {
    const collection = library.current;
    const board = engine.current;
    if (!collection || !board || !activeDrawing || changingDrawing.current) return;
    changingDrawing.current = true;
    documentRevision.current++;
    setReady(false);
    setLibraryMessage('Saving drawing…');
    try {
      if (action === 'open') {
        const target = collection.list().find(item => item.id === id);
        if (!target) throw new Error('Drawing no longer exists.');
        const parsed = parseDocument(target.json);
        if (parsed.width !== 1000 || parsed.height !== 700) throw new Error('Unsupported drawing dimensions.');
      }
      // Retry the latest snapshot before leaving; a failed save keeps this drawing open.
      await collection.save(board.exportJSON());
      const drawing = action === 'create' ? await collection.create(emptyDocument)
        : action === 'rename' ? await collection.rename(drawingName)
        : await collection.open(id!);
      if (engine.current !== board) return;
      if (action !== 'rename') {
        loadingDocument.current = true;
        try { board.loadJSON(drawing.json, { resetHistory: true }); }
        finally { loadingDocument.current = false; }
        setFileMessage('');
      }
      setActiveDrawing(drawing);
      setDrawingName(drawing.name);
      setSaveStatus('Saved on this device');
      setLibraryMessage(action === 'rename' ? 'Drawing renamed.' : 'Drawing opened.');
      if (action !== 'rename') setLibraryOpen(false);
    } catch (error) {
      setLibraryMessage(error instanceof Error ? error.message : 'Unable to update drawings.');
    } finally {
      changingDrawing.current = false;
      if (engine.current === board) {
        setDrawings(collection.list());
        setReady(true);
      }
    }
  }

  function step(redo: boolean) {
    if (redo) engine.current?.redo();
    else engine.current?.undo();
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!ready || libraryOpen || event.isComposing || event.repeat || event.altKey) return;
      if (event.target instanceof HTMLElement &&
          (event.target.isContentEditable || event.target.closest('input, textarea, select'))) return;
      const key = event.key.toLowerCase();
      if (event.metaKey || event.ctrlKey) {
        if (key === 'z') {
          event.preventDefault();
          step(event.shiftKey);
        } else if (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey) {
          event.preventDefault();
          step(true);
        }
      } else if (!event.shiftKey && (key === 'b' || key === 'e')) {
        event.preventDefault();
        setTool(key === 'b' ? 'pen' : 'eraser');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ready, libraryOpen]);

  function exportFile(format: 'SVG' | 'JSON') {
    const board = engine.current;
    if (!board) return;
    try {
      const content = format === 'SVG'
        ? board.exportSVG({ crop: cropExport, padding: exportPadding })
        : board.exportJSON();
      const blob = new Blob([content], { type: format === 'SVG' ? 'image/svg+xml' : 'application/json' });
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = `calamus.${format.toLowerCase()}`;
        link.click();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setFileMessage(`${format} export ready.`);
    } catch (error) {
      setFileMessage(error instanceof Error ? error.message : `Unable to export ${format}.`);
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
            onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void importer.current?.read(file); event.currentTarget.value = ''; }} />
          <button onClick={() => fileInput.current?.click()}>Import JSON</button>
          <button onClick={() => exportFile('JSON')}>Export JSON</button>
          <button onClick={() => exportFile('SVG')}>Export SVG</button>
          <button className="primary" disabled={exporting} onClick={() => void exportImage()}>{exporting ? 'Exporting…' : 'Export PNG'}</button>
        </div>
      </header>
      <main>
        <section className="workspace" aria-label="Drawing workspace">
          <div className="workbar">
            <h1>{activeDrawing?.name ?? 'Untitled drawing'}</h1>
            <button ref={libraryButton} disabled={!activeDrawing} aria-haspopup="dialog"
              onClick={() => { setDrawingName(activeDrawing?.name ?? ''); setLibraryMessage(''); setLibraryOpen(true); }}>Drawings</button>
            {mobile && <button ref={settingsButton} aria-haspopup="dialog" aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen(true)}>Settings</button>}
            <div className="actions">
              <button disabled={!counts.undo} onClick={() => step(false)}>Undo</button>
              <button disabled={!counts.redo} onClick={() => step(true)}>Redo</button>
              <button disabled={!counts.strokes} onClick={() => engine.current?.clear()}>Clear</button>
            </div>
          </div>
          <p role="status">{fileMessage}</p>
          <div className={'paper ' + paper}>
            <canvas ref={canvas} aria-label="Drawing canvas" onPointerDownCapture={() => { documentRevision.current++; }} />
            {!counts.strokes && <span className="paper-hint">Draw anywhere to begin</span>}
          </div>
          <p className="status">{counts.strokes} {counts.strokes === 1 ? 'stroke' : 'strokes'} <span>1000 × 700 px</span></p>
        </section>
        <dialog ref={panel} className="settings-panel" aria-label="Drawing settings"
          onCancel={() => setSettingsOpen(false)}
          onClose={() => {
            if (mobile && !panel.current?.open) settingsButton.current?.focus();
          }}>
          {mobile && <div className="panel-heading"><h2>Settings</h2>
            <button onClick={() => setSettingsOpen(false)}>Close</button></div>}
          <section>
            <h2>Tool</h2>
            <div className="actions">
              <button title="Pen (B)" aria-keyshortcuts="B" aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}>Pen</button>
              <button title="Eraser (E)" aria-keyshortcuts="E" aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>Eraser</button>
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
        </dialog>
      </main>
      </div>
      <dialog ref={libraryDialog} className="library-panel" aria-labelledby="library-title"
        onCancel={event => { if (changingDrawing.current) event.preventDefault(); else setLibraryOpen(false); }}
        onClose={() => { setLibraryOpen(false); libraryButton.current?.focus(); }}>
        <div className="panel-heading"><h2 id="library-title">Your drawings</h2>
          <button disabled={!ready} onClick={() => setLibraryOpen(false)}>Close</button></div>
        <p>Saved on this device. Export JSON to keep a backup.</p>
        <button className="primary" disabled={!ready} onClick={() => void changeDrawing('create')}>New drawing</button>
        <ul className="drawing-list">
          {drawings.map(drawing => <li key={drawing.id}>
            <button disabled={!ready || drawing.id === activeDrawing?.id}
              aria-current={drawing.id === activeDrawing?.id ? 'true' : undefined}
              onClick={() => void changeDrawing('open', drawing.id)}>
              <span>{drawing.name}</span>{drawing.id === activeDrawing?.id && <small>Current</small>}
            </button>
          </li>)}
        </ul>
        <form onSubmit={event => { event.preventDefault(); void changeDrawing('rename'); }}>
          <label htmlFor="drawing-name">Current drawing name</label>
          <div className="rename-row"><input id="drawing-name" value={drawingName} maxLength={80} required disabled={!ready}
            onChange={event => setDrawingName(event.currentTarget.value)} />
            <button disabled={!ready || !drawingName.trim() || drawingName.trim() === activeDrawing?.name}>Rename</button></div>
        </form>
        <p role="status">{libraryMessage}</p>
      </dialog>
      <p className="save-status" role="status">{saveStatus}</p>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
