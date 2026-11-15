import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  .replace("import { Calamus } from '@calamus/core';", '');

function fixture() {
  const elements = new Map(), pageEvents = new Map(), instances = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      value: ({ tool: 'pen', color: '#253631', size: '6', stability: 'smooth' })[id] ?? '',
      events: new Map(), addEventListener(name, handler) { this.events.set(name, handler); },
    });
    return elements.get(id);
  };
  class Calamus {
    state = { strokes: 1, undo: false, redo: false };
    data = 'saved drawing';
    destroyed = 0;
    constructor() { instances.push(this); }
    setTool() {}
    setBrush() {}
    exportJSON() { return this.data; }
    loadJSON(data, options) { this.data = data; this.loadOptions = options; }
    destroy() { this.destroyed++; }
  }
  runInNewContext(source, { Calamus,
    document: { querySelector: selector => element(selector.slice(1)), getElementById: element },
    window: { addEventListener: (name, handler) => pageEvents.set(name, handler) },
  });
  return { instances, element, click: () => element('lifecycle').events.get('click')(),
    hide: () => pageEvents.get('pagehide')(), show: persisted => pageEvents.get('pageshow')({ persisted }) };
}

test('active instance restores its document once after a cached navigation', () => {
  const f = fixture();
  f.instances[0].data = 'updated drawing';
  f.hide();
  assert.equal(f.instances[0].destroyed, 1);
  f.show(true);
  assert.equal(f.instances.length, 2);
  assert.equal(f.instances[1].data, 'updated drawing');
  assert.equal(f.instances[1].loadOptions.resetHistory, true);
  f.show(true);
  assert.equal(f.instances.length, 2);
});

test('manually destroyed instance stays destroyed across cached navigation', () => {
  const f = fixture();
  f.click();
  f.hide(); f.show(true);
  assert.equal(f.instances.length, 1);
  assert.equal(f.instances[0].destroyed, 1);
  assert.equal(f.element('lifecycle').textContent, 'Create instance');
  assert.equal(f.element('png').disabled, true);
  f.click();
  assert.equal(f.instances.length, 2);
  assert.equal(f.instances[1].data, 'saved drawing');
  assert.equal(f.element('png').disabled, false);
});

test('non-cached pageshow does not create a duplicate instance', () => {
  const f = fixture();
  f.show(false);
  assert.equal(f.instances.length, 1);
  f.hide(); f.show(false);
  assert.equal(f.instances.length, 1);
});
