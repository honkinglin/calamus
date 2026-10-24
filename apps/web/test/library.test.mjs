import test from 'node:test';
import assert from 'node:assert/strict';
import { createLibrary } from '../src/library.ts';

function fixture(initial = [], activeId) {
  const records = new Map(initial.map(item => [item.id, { ...item }]));
  let selected = activeId;
  const store = {
    read: async () => ({ drawings: [...records.values()].map(item => ({ ...item })), activeId: selected }),
    save: async drawing => { records.set(drawing.id, { ...drawing }); },
    select: async id => { selected = id; },
    replaceSelection: async (drawing, next) => {
      records.set(drawing.id, { ...drawing }); records.set(next.id, { ...next }); selected = next.id;
    },
  };
  return { store, records, library: createLibrary(store) };
}
const original = { id: 'legacy', name: 'Original', json: 'original', updatedAt: 1 };

test('restores legacy drawing without replacing its content', async () => {
  const f = fixture([original], 'legacy');
  assert.deepEqual(await f.library.restore('empty'), original);
  assert.equal(f.records.size, 1);
});
test('first launch creates one drawing and subsequent restore selects it', async () => {
  const f = fixture();
  const first = await f.library.restore('empty');
  assert.equal(first.json, 'empty');
  const next = createLibrary(f.store);
  assert.deepEqual(await next.restore('other'), first);
  assert.equal(f.records.size, 1);
});
test('queued saves keep captured IDs and complete before switching', async () => {
  const f = fixture([original, { ...original, id: 'second', json: 'second' }], 'legacy');
  await f.library.restore('empty');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const save = f.store.save;
  f.store.save = async drawing => { await gate; await save(drawing); };
  const first = f.library.save('stroke one');
  const second = f.library.save('stroke two');
  const switching = f.library.open('second');
  assert.equal(f.library.current().id, 'legacy');
  release();
  await Promise.all([first, second, switching]);
  assert.equal(f.records.get('legacy').json, 'stroke two');
  assert.equal(f.records.get('second').json, 'second');
  await f.library.save('second edited');
  assert.equal(f.records.get('legacy').json, 'stroke two');
  assert.equal(f.records.get('second').json, 'second edited');
});
test('save failure blocks leaving and retry can recover latest content', async () => {
  const f = fixture([original], 'legacy');
  await f.library.restore('empty');
  const save = f.store.save;
  f.store.save = async () => { throw new Error('quota'); };
  await assert.rejects(f.library.save('unsaved'), /quota/);
  await assert.rejects(f.library.create('empty'), /quota/);
  assert.equal(f.library.current().id, 'legacy');
  assert.equal(f.library.current().json, 'unsaved');
  f.store.save = save;
  await f.library.save('retry');
  const created = await f.library.create('empty');
  assert.notEqual(created.id, 'legacy');
  assert.equal(f.records.get('legacy').json, 'retry');
});
test('rename trims, persists and preserves document content', async () => {
  const f = fixture([original], 'legacy');
  await f.library.restore('empty');
  const renamed = await f.library.rename('  Sketch  ');
  assert.equal(renamed.name, 'Sketch');
  assert.equal(renamed.json, 'original');
  assert.equal(f.records.get('legacy').name, 'Sketch');
  await assert.rejects(f.library.rename('   '), /1 and 80/);
  await assert.rejects(f.library.rename('x'.repeat(81)), /1 and 80/);
});
test('failed rename or selection leaves current drawing unchanged', async () => {
  const f = fixture([original, { ...original, id: 'second' }], 'legacy');
  await f.library.restore('empty');
  f.store.save = async () => { throw new Error('write failed'); };
  await assert.rejects(f.library.rename('Changed'), /write failed/);
  assert.equal(f.library.current().name, 'Original');
  f.store.select = async () => { throw new Error('selection failed'); };
  await assert.rejects(f.library.open('second'), /selection failed/);
  assert.equal(f.library.current().id, 'legacy');
});
test('read access returns copies and missing active ID falls back safely', async () => {
  const f = fixture([original], 'missing');
  await f.library.restore('empty');
  f.library.current().name = 'Changed';
  f.library.list()[0].json = 'Changed';
  assert.equal(f.library.current().name, 'Original');
  assert.equal(f.library.current().json, 'original');
  await assert.rejects(f.library.open('missing'), /no longer exists/);
});
test('saved new drawing remains discoverable if selecting it fails', async () => {
  const f = fixture([original], 'legacy');
  await f.library.restore('empty');
  f.store.select = async () => { throw new Error('selection failed'); };
  await assert.rejects(f.library.create('new'), /selection failed/);
  assert.equal(f.library.current().id, 'legacy');
  assert.equal(f.library.list().length, 2);
  assert.equal(f.records.size, 2);
});

test('duplicate uses a new ID and edits never modify the source', async () => {
  const f = fixture([original], 'legacy');
  await f.library.restore('empty');
  await f.library.save('latest');
  const copy = await f.library.duplicate();
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.name, 'Original (copy)');
  assert.equal(copy.json, 'latest');
  await f.library.save('copy edited');
  assert.equal(f.records.get(original.id).json, 'latest');
  assert.equal(f.records.get(copy.id).json, 'copy edited');
});
test('delete persists recoverable content and opens a blank drawing atomically', async () => {
  const f = fixture([original], 'legacy');
  await f.library.restore('empty');
  const next = await f.library.remove('empty');
  assert.equal(next.json, 'empty');
  assert.equal(f.library.list().length, 1);
  assert.equal(f.library.trash()[0].json, 'original');
  const restored = createLibrary(f.store);
  assert.equal((await restored.restore('empty')).id, next.id);
  assert.equal(restored.trash()[0].id, 'legacy');
  await restored.recover('legacy');
  assert.equal(restored.current().id, next.id);
  assert.equal(restored.trash().length, 0);
  assert.equal((await restored.open('legacy')).json, 'original');
});
test('failed delete leaves both current drawing and lists unchanged', async () => {
  const f = fixture([original], 'legacy');
  await f.library.restore('empty');
  f.store.replaceSelection = async () => { throw new Error('transaction failed'); };
  await assert.rejects(f.library.remove('empty'), /transaction failed/);
  assert.deepEqual(f.library.current(), original);
  assert.equal(f.library.trash().length, 0);
  assert.equal(f.library.list().length, 1);
});
test('failed recovery retains the deleted drawing', async () => {
  const f = fixture([original], 'legacy');
  await f.library.restore('empty');
  await f.library.remove('empty');
  f.store.save = async () => { throw new Error('quota'); };
  await assert.rejects(f.library.recover('legacy'), /quota/);
  assert.equal(f.library.trash().length, 1);
  await assert.rejects(f.library.open('legacy'), /no longer exists/);
});
test('restore never activates deleted data and keeps it recoverable', async () => {
  const f = fixture([{ ...original, deletedAt: 1 }], 'legacy');
  const current = await f.library.restore('empty');
  assert.notEqual(current.id, 'legacy');
  assert.equal(f.library.trash().length, 1);
  assert.equal(f.library.list().length, 1);
});
