import test from 'node:test';
import assert from 'node:assert/strict';
import { Calamus, parseDocument } from '../dist/index.js';

test('committed geometry is cached, DPR invalidates it and destroy removes observers', async () => {
  const saved = new Map();
  const install = (name, value) => {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value });
  };
  const queries = [];
  let observer;
  let scheduled;
  let frameId = 0;
  const frames = new Map();
  class Pointer extends Event {
    constructor(type, values) { super(type); Object.assign(this, values); }
  }
  class Surface extends EventTarget {
    width = 300;
    height = 150;
    clientWidth = 500;
    clientHeight = 350;
    style = { touchAction: 'auto' };
    fills = 0;
    ownerDocument = { createElement: () => new Surface() };
    toBlob(callback) { callback(new Blob(['png'], { type: 'image/png' })); }
    getContext() {
      return {
        globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', shadowColor: 'rgba(0, 0, 0, 0)',
        setTransform() {}, clearRect() {}, drawImage() {}, beginPath() {}, fillRect() {},
        moveTo() {}, lineTo() {}, closePath() {},
        fill: () => { this.fills++; },
      };
    }
    getBoundingClientRect() { return { left: 0, top: 0, width: 500, height: 350 }; }
    setPointerCapture() {}
    hasPointerCapture() { return false; }
  }
  try {
    const browser = new EventTarget();
    browser.devicePixelRatio = 1;
    browser.matchMedia = () => {
      const query = new EventTarget();
      queries.push(query);
      return query;
    };
    install('window', browser);
    install('PointerEvent', Pointer);
    install('ResizeObserver', class {
      constructor(callback) { observer = this; this.callback = callback; }
      observe() {}
      disconnect() { this.disconnected = true; }
    });
    install('requestAnimationFrame', callback => {
      const id = ++frameId;
      frames.set(id, callback);
      scheduled = time => { frames.delete(id); callback(time); };
      return id;
    });
    install('cancelAnimationFrame', id => {
      frames.delete(id);
      const latest = [...frames.entries()].at(-1);
      if (latest) scheduled = time => { frames.delete(latest[0]); latest[1](time); };
    });
    const surface = new Surface();
    const cache = new Surface();
    surface.ownerDocument.createElement = () => cache;
    const replayStates = [];
    const engine = new Calamus(surface, { onReplayChange: state => replayStates.push(state) });
    engine.setStrokes([{ brush: { color: '#000', size: 5 }, points: [{ x: 0, y: 0, time: 0, pressure: null }] }]);
    for (const invalid of [0, 0.5, 32769, Infinity, NaN]) {
      assert.throws(() => new Calamus(surface, { width: invalid }), /dimensions/);
      assert.throws(() => new Calamus(surface, { height: invalid }), /dimensions/);
    }
    const originalBrush = { ...engine.brush };
    for (const invalid of [{ color: 'red' }, { color: '#12' }, { size: 0.001 }, { size: 4097 },
      { smoothing: NaN }, { stabilizer: 4097 }, { velocityWidth: 'yes' }]) {
      assert.throws(() => engine.setBrush(invalid));
      assert.deepEqual(engine.brush, originalBrush, 'invalid settings must not replace the current brush');
    }
    const before = engine.exportJSON();
    const historyBefore = engine.state;
    assert.throws(() => engine.loadJSON('{"schemaVersion":2}'));
    assert.equal(engine.exportJSON(), before);
    assert.deepEqual(engine.state, historyBefore);
    engine.loadJSON(before);
    engine.undo();
    assert.equal(engine.exportJSON(), before);
    assert.throws(() => engine.play({ speed: 0 }), /speed/);
    const unchanged = engine.exportJSON();
    const unchangedHistory = engine.state;
    engine.play({ speed: 2 });
    scheduled(0);
    engine.pauseReplay();
    engine.resumeReplay();
    scheduled(1000);
    assert.equal(replayStates.at(-1), 'playing');
    scheduled(1060);
    assert.deepEqual(replayStates, ['playing', 'paused', 'playing', 'idle']);
    assert.equal(engine.exportJSON(), unchanged);
    assert.deepEqual(engine.state, unchangedHistory);
    engine.play();
    engine.clear();
    assert.equal(replayStates.at(-1), 'idle');
    engine.undo();
    const fills = cache.fills;
    surface.dispatchEvent(new Pointer('pointerdown', { pointerId: 1, button: 0, isPrimary: true, clientX: 10, clientY: 10, pointerType: 'mouse' }));
    scheduled();
    assert.equal(cache.fills, fills);
    const activeGeometry = engine.active.geometry;
    const firstPolygon = activeGeometry.geometry[0];
    surface.dispatchEvent(new Pointer('pointermove', {
      pointerId: 1, clientX: 30, clientY: 20, pointerType: 'mouse',
      getCoalescedEvents: () => [
        new Pointer('pointermove', { clientX: 20, clientY: 15, pointerType: 'mouse' }),
        new Pointer('pointermove', { clientX: 30, clientY: 20, pointerType: 'mouse' }),
      ],
    }));
    scheduled();
    assert.equal(engine.active.processed.length, 3);
    assert.equal(activeGeometry.geometry[0], firstPolygon);
    const geometrySize = activeGeometry.vertexCount;
    browser.devicePixelRatio = 2;
    queries[0].dispatchEvent(new Event('change'));
    assert.equal(surface.width, 1000);
    assert.equal(cache.fills, fills + 1);
    assert.equal(activeGeometry.vertexCount, geometrySize);
    engine.clear();
    assert.equal(engine.active, null);
    assert.equal(engine.state.strokes, 0);
    engine.undo();
    assert.equal(engine.state.strokes, 1);
    engine.redo();
    assert.equal(engine.state.strokes, 0);
    engine.undo();
    const snapshot = engine.getStrokes();
    snapshot[0].points[0].x = 999;
    assert.equal(engine.getStrokes()[0].points[0].x, 0);
    engine.setStrokes([]);
    assert.equal(engine.state.redo, 0);
    engine.setStrokes([{ brush: { color: '#000', size: 5 }, points: [
      { x: 100, y: 100, time: 0, pressure: null },
      { x: 200, y: 100, time: 50, pressure: null },
    ] }]);
    engine.setTool('eraser');
    const dispatch = (type, y) => surface.dispatchEvent(new Pointer(type, {
      pointerId: 2, button: 0, isPrimary: true, clientX: 75, clientY: y, pointerType: 'mouse',
    }));
    const historyBeforeErase = engine.state.undo;
    const fillsBeforeMiss = cache.fills;
    dispatch('pointerdown', 0);
    scheduled(0);
    dispatch('pointermove', -20);
    scheduled(0);
    dispatch('pointerup', -20);
    assert.equal(cache.fills, fillsBeforeMiss, 'eraser misses must not rebuild committed content');
    assert.equal(engine.state.undo, historyBeforeErase, 'misses must not create history');
    dispatch('pointerdown', 0);
    dispatch('pointermove', 100);
    dispatch('pointercancel', 100);
    assert.equal(engine.state.strokes, 1);
    assert.equal(engine.state.undo, historyBeforeErase);
    dispatch('pointerdown', 0);
    dispatch('pointerup', 100);
    assert.equal(engine.state.strokes, 0);
    assert.equal(engine.state.undo, historyBeforeErase + 1);
    engine.undo();
    assert.equal(engine.state.strokes, 1);
    engine.setTool('pen');
    engine.clear();
    const input = (type, values = {}) => surface.dispatchEvent(new Pointer(type, {
      pointerId: 3, button: 0, isPrimary: true, clientX: 0, clientY: 0, pointerType: 'touch', ...values,
    }));
    const normalBounds = surface.getBoundingClientRect;
    for (const invalidBounds of [
      { left: 0, top: 0, width: 0, height: 350 },
      { left: 0, top: 0, width: 500, height: 0 },
      { left: NaN, top: 0, width: 500, height: 350 },
    ]) {
      surface.getBoundingClientRect = () => invalidBounds;
      input('pointerdown');
      assert.equal(engine.active, null, 'invalid bounds must reject starting a gesture');
      surface.getBoundingClientRect = normalBounds;
      input('pointerdown');
      surface.getBoundingClientRect = () => invalidBounds;
      input('pointermove', { clientX: 10 });
      assert.equal(engine.active, null, 'invalid move must cancel the gesture');
      assert.equal(engine.state.strokes, 0);
      surface.getBoundingClientRect = normalBounds;
    }
    for (const invalid of [{ clientX: Infinity }, { clientY: NaN }, { clientX: 1e12 },
      { pointerType: 'pen', pressure: 2 }, { pointerType: 'pen', pressure: NaN }]) {
      input('pointerdown', invalid);
      assert.equal(engine.active, null);
      input('pointerdown');
      input('pointerup', invalid);
      assert.equal(engine.active, null);
      assert.equal(engine.state.strokes, 0, 'invalid final input must not commit a partial gesture');
    }
    engine.setBrush({ color: '#aBc8', size: 0.01, smoothing: 1, stabilizer: 4096, velocityWidth: false });
    input('pointerdown');
    input('pointercancel', { pointerId: 4 });
    input('pointerup');
    assert.equal(engine.state.strokes, 1, 'other pointers must not cancel the primary touch');
    const roundTrip = parseDocument(engine.exportJSON());
    assert.deepEqual(roundTrip.strokes, engine.getStrokes());
    engine.setBrush(originalBrush);
    const beforeInvalidErase = engine.exportJSON();
    const beforeInvalidEraseState = engine.state;
    engine.setTool('eraser');
    input('pointerdown');
    assert.equal(engine.erased.size, 1);
    surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
    input('pointermove');
    surface.getBoundingClientRect = normalBounds;
    assert.equal(engine.erased.size, 0, 'invalid erase sampling restores provisional removals');
    assert.equal(engine.exportJSON(), beforeInvalidErase);
    assert.deepEqual(engine.state, beforeInvalidEraseState);
    engine.setTool('pen');
    input('pointerdown');
    input('pointermove', { getCoalescedEvents: () => [
      new Pointer('pointermove', { clientX: 10, clientY: 10, pointerType: 'mouse' }),
      new Pointer('pointermove', { clientX: NaN, clientY: 10, pointerType: 'mouse' }),
    ] });
    assert.equal(engine.active, null, 'invalid coalesced input cancels the entire gesture');
    assert.equal(engine.exportJSON(), beforeInvalidErase);

    const temporal = (type, time, x) => {
      const event = new Pointer(type, { pointerId: 3, button: 0, isPrimary: true, clientX: x, clientY: 0, pointerType: 'mouse' });
      Object.defineProperty(event, 'timeStamp', { value: time });
      surface.dispatchEvent(event);
    };
    temporal('pointerdown', 100, 0);
    temporal('pointermove', 120, 10);
    temporal('pointermove', 110, 20);
    temporal('pointerup', 115, 30);
    assert.deepEqual(engine.getStrokes().at(-1).points.map(point => point.time), [0, 20, 20, 20]);
    assert.doesNotThrow(() => parseDocument(engine.exportJSON()));
    engine.undo();

    assert.equal(engine.getStrokes()[0].points[0].x, 0);
    assert.equal(engine.getStrokes()[0].points[0].pressure, null);
    input('pointerdown', { clientX: 50, clientY: 50 });
    input('pointerup', { clientX: 600, clientY: 400 });
    const afterRelease = engine.exportJSON();
    input('pointermove', { clientX: 30 });
    assert.equal(engine.exportJSON(), afterRelease, 'moves after release must not extend a stroke');
    assert.equal(engine.getStrokes()[1].points.at(-1).x, 1200);
    input('pointerdown', { pointerType: 'pen', pressure: 0 });
    input('pointerup', { pointerType: 'pen', pressure: 0 });
    assert.equal(engine.getStrokes()[2].points[0].pressure, 0);
    input('pointerdown');
    browser.dispatchEvent(new Event('blur'));
    input('pointerup');
    assert.equal(engine.state.strokes, 3, 'blur must discard the active gesture');
    const preservedDocument = engine.exportJSON();
    const preservedState = engine.state;
    const invalidStrokes = engine.getStrokes();
    invalidStrokes[0].points[0].x = NaN;
    assert.throws(() => engine.setStrokes(invalidStrokes), /numeric/);
    assert.equal(engine.exportJSON(), preservedDocument);
    assert.deepEqual(engine.state, preservedState);
    assert.throws(() => engine.loadJSON('{"schemaVersion":9}', { resetHistory: true }));
    assert.deepEqual(engine.state, preservedState);
    engine.loadJSON(preservedDocument, { resetHistory: true });
    assert.equal(engine.state.undo, 0);
    assert.equal(engine.state.redo, 0);
    assert.equal(engine.exportJSON(), preservedDocument);
    engine.undo();
    assert.equal(engine.exportJSON(), preservedDocument);
    engine.clear();
    engine.undo();
    assert.equal(engine.exportJSON(), preservedDocument);
    const exportedCanvas = new Surface();
    surface.ownerDocument.createElement = () => exportedCanvas;
    const png = await engine.exportPNG({ scale: 2 });
    assert.equal(png.type, 'image/png');
    assert.equal(exportedCanvas.width, 2000);
    assert.equal(exportedCanvas.height, 1400);
    assert.throws(() => engine.exportPNG({ scale: Infinity }), /scale/);
    exportedCanvas.toBlob = callback => callback(null);
    await assert.rejects(engine.exportPNG(), /encode/);
    engine.clear();
    surface.getBoundingClientRect = () => ({ left: -300, top: -140, width: 1000, height: 700 });
    input('pointerdown', { clientX: 200, clientY: 210 });
    input('pointerup', { clientX: 200, clientY: 210 });
    const zoomedPoint = engine.getStrokes()[0].points[0];
    assert.equal(zoomedPoint.x, 500, 'zoomed and scrolled canvas maps to logical x');
    assert.equal(zoomedPoint.y, 350, 'zoomed and scrolled canvas maps to logical y');
    const viewIndependentJSON = engine.exportJSON();
    surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 350 });
    assert.equal(engine.exportJSON(), viewIndependentJSON, 'view changes cannot mutate document data');
    const rasterSurfaces = [];
    surface.ownerDocument.createElement = () => {
      const canvas = new Surface(); rasterSurfaces.push(canvas); return canvas;
    };
    for (const outcome of ['pointercancel', 'pointerup', 'destroy']) {
      const beforeGesture = engine.getStrokes().length;
      input('pointerdown');
      for (let i = 1; i <= 70; i++) input('pointermove', { clientX: i, clientY: i / 2 });
      scheduled();
      const rasterCanvas = rasterSurfaces.at(-1);
      assert.ok(rasterCanvas.width > 0, 'long opaque gesture allocates raster storage');
      const cachedFills = rasterCanvas.fills;
      observer.callback();
      assert.equal(rasterCanvas.fills, cachedFills, 'unchanged resize does not redraw cached prefix');
      if (outcome === 'destroy') engine.destroy();
      else input(outcome, { clientX: 70, clientY: 35 });
      assert.equal(rasterCanvas.width, 0, 'ending, cancelling or destroying releases raster storage');
      assert.equal(engine.active, null);
      if (outcome !== 'destroy') assert.equal(engine.getStrokes().length, beforeGesture + (outcome === 'pointerup' ? 1 : 0));
    }
    assert.throws(() => engine.undo(), /destroyed/);
    assert.throws(() => engine.setBrush({ size: 6 }), /destroyed/);
    assert.equal(observer.disconnected, true);
    assert.equal(surface.style.touchAction, 'auto');
    const queryCount = queries.length;
    queries.at(-1).dispatchEvent(new Event('change'));
    assert.equal(queries.length, queryCount);
    surface.style.touchAction = 'pan-x';
    engine.destroy();
    assert.equal(surface.style.touchAction, 'pan-x', 'repeated destruction must not override a later owner');
    assert.equal(cache.width, 0, 'committed raster storage must be released');
    assert.equal(cache.height, 0);

    const throwingSurface = new Surface();
    const callbackError = new Error('Host callback failed');
    let idleCalls = 0;
    const throwingEngine = new Calamus(throwingSurface, { onReplayChange: state => {
      if (state === 'idle') {
        idleCalls++;
        assert.equal(throwingEngine.controller.signal.aborted, true, 'cleanup precedes host notification');
        throwingSurface.style.touchAction = 'pan-y';
        throwingEngine.destroy();
        throw callbackError;
      }
    } });
    const throwingObserver = observer;
    throwingEngine.setStrokes([{ brush: { color: '#000', size: 6 }, points: [{ x: 1, y: 1, time: 0, pressure: null }] }]);
    throwingEngine.play();
    assert.throws(() => throwingEngine.destroy(), error => error === callbackError);
    assert.equal(throwingObserver.disconnected, true, 'host exceptions must not prevent observer cleanup');
    assert.equal(throwingSurface.style.touchAction, 'pan-y', 'host changes after cleanup must survive');
    assert.equal(throwingEngine.committedCanvas.width, 0);
    assert.equal(throwingEngine.committedCanvas.height, 0);
    assert.equal(throwingEngine.controller.signal.aborted, true);
    assert.equal(throwingEngine.active, null);
    assert.equal(throwingEngine.playback, null);
    assert.equal(frames.has(throwingEngine.playbackFrame), false);
    throwingSurface.dispatchEvent(new Pointer('pointerdown', { pointerId: 9, button: 0, isPrimary: true, clientX: 1, clientY: 1 }));
    assert.equal(throwingEngine.active, null, 'destroyed engine must no longer receive input');
    throwingEngine.destroy();
    assert.equal(idleCalls, 1, 'reentrant and repeated destroy must not notify again');

  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
