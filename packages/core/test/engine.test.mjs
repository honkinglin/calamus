import test from 'node:test';
import assert from 'node:assert/strict';
import { Calamus } from '../dist/index.js';

test('committed geometry is cached, DPR invalidates it and destroy removes observers', () => {
  const saved = new Map();
  const install = (name, value) => {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value });
  };
  const queries = [];
  let observer;
  let scheduled;
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
    getContext() {
      return {
        setTransform() {}, clearRect() {}, drawImage() {}, beginPath() {},
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
    install('requestAnimationFrame', callback => { scheduled = callback; return 1; });
    install('cancelAnimationFrame', () => { scheduled = undefined; });
    const surface = new Surface();
    const cache = new Surface();
    surface.ownerDocument.createElement = () => cache;
    const engine = new Calamus(surface);
    engine.setStrokes([{ brush: { color: '#000', size: 5 }, points: [{ x: 0, y: 0, time: 0, pressure: null }] }]);
    const fills = cache.fills;
    surface.dispatchEvent(new Pointer('pointerdown', { pointerId: 1, button: 0, isPrimary: true, clientX: 10, clientY: 10, pointerType: 'mouse' }));
    scheduled();
    assert.equal(cache.fills, fills);
    browser.devicePixelRatio = 2;
    queries[0].dispatchEvent(new Event('change'));
    assert.equal(surface.width, 1000);
    assert.equal(cache.fills, fills + 1);
    engine.destroy();
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
