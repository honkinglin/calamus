import test from 'node:test';
import assert from 'node:assert/strict';
import { createImportController } from '../src/import-controller.ts';

function fixture(loadError) {
  let revision = 0;
  const loaded = [], messages = [];
  const controller = createImportController({
    revision: () => revision,
    load: json => { if (loadError) throw loadError; loaded.push(json); revision++; },
    notify: message => messages.push(message),
  });
  return { controller, loaded, messages, edit: () => revision++ };
}
function deferredFile() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { file: { size: 10, text: () => promise }, resolve, reject };
}

test('successful import loads once and announces undo', async () => {
  const f = fixture();
  await f.controller.read({ size: 10, text: async () => 'drawing' });
  assert.deepEqual(f.loaded, ['drawing']);
  assert.match(f.messages.at(-1), /Use Undo/);
});
test('editing during file reading preserves the new drawing', async () => {
  const f = fixture(), pending = deferredFile();
  const read = f.controller.read(pending.file);
  f.edit();
  pending.resolve('old drawing');
  await read;
  assert.deepEqual(f.loaded, []);
  assert.match(f.messages.at(-1), /Drawing changed/);
});
test('latest selection wins when reads finish out of order', async () => {
  const f = fixture(), first = deferredFile(), second = deferredFile();
  const a = f.controller.read(first.file), b = f.controller.read(second.file);
  second.resolve('new');
  await b;
  first.resolve('old');
  await a;
  assert.deepEqual(f.loaded, ['new']);
  assert.match(f.messages.at(-1), /Use Undo/);
});
test('stale read failures do not replace current feedback', async () => {
  const f = fixture(), first = deferredFile();
  const a = f.controller.read(first.file);
  await f.controller.read({ size: 10, text: async () => 'new' });
  const message = f.messages.at(-1);
  first.reject(new Error('old failure'));
  await a;
  assert.equal(f.messages.at(-1), message);
});
test('disposed controllers ignore pending and new imports', async () => {
  const f = fixture(), pending = deferredFile();
  const read = f.controller.read(pending.file);
  f.controller.dispose();
  pending.resolve('ignored');
  await read;
  await f.controller.read({ size: 10, text: async () => assert.fail('must not read') });
  assert.deepEqual(f.loaded, []);
  assert.equal(f.messages.length, 1);
});
test('oversized files are rejected before reading', async () => {
  const f = fixture();
  await f.controller.read({ size: 20_000_001, text: async () => assert.fail('must not read') });
  assert.deepEqual(f.loaded, []);
  assert.match(f.messages.at(-1), /20 MB/);
});
test('read and validation errors report failure without success', async () => {
  const f = fixture();
  await f.controller.read({ size: 10, text: async () => { throw new Error('Read failed'); } });
  assert.equal(f.messages.at(-1), 'Read failed');
  const invalid = fixture(new Error('Invalid document'));
  await invalid.controller.read({ size: 10, text: async () => 'invalid' });
  assert.deepEqual(invalid.loaded, []);
  assert.equal(invalid.messages.at(-1), 'Invalid document');
});
