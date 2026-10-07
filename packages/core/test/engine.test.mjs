import test from 'node:test';
import assert from 'node:assert/strict';
import { Calamus } from '../dist/index.js';

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
    browser.devicePixelRatio = 2;
    queries[0].dispatchEvent(new Event('change'));
    assert.equal(surface.width, 1000);
    assert.equal(cache.fills, fills + 1);
    engine.clear();
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
    const exportedCanvas = new Surface();
    surface.ownerDocument.createElement = () => exportedCanvas;
    const png = await engine.exportPNG({ scale: 2 });
    assert.equal(png.type, 'image/png');
    assert.equal(exportedCanvas.width, 2000);
    assert.equal(exportedCanvas.height, 1400);
    assert.throws(() => engine.exportPNG({ scale: Infinity }), /scale/);
    exportedCanvas.toBlob = callback => callback(null);
    await assert.rejects(engine.exportPNG(), /encode/);
    engine.destroy();
    assert.throws(() => engine.undo(), /destroyed/);
    assert.equal(observer.disconnected, true);
    assert.equal(surface.style.touchAction, 'auto');
    const queryCount = queries.length;
    queries.at(-1).dispatchEvent(new Event('change'));
    assert.equal(queries.length, queryCount);
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
