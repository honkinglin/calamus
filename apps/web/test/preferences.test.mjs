import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePreferences, defaultPreferences, brushColor } from '../src/preferences.ts';

test('invalid or missing appearance preferences fall back safely', () => {
  for (const input of [null, '', '{', 'null', '42', '{"theme":"unknown","paperColor":"red"}']) {
    assert.deepEqual(parsePreferences(input), defaultPreferences);
  }
});
test('valid preferences round trip without accepting unknown colors', () => {
  const settings = { theme: 'dark', paperColor: '#e9f0e8', guides: 'plain', drawingOrder: 'name' };
  assert.deepEqual(parsePreferences(JSON.stringify(settings)), settings);
  assert.equal(parsePreferences('{"paperColor":"#123456"}').paperColor, '#fffdf7');
});
test('highlighter preserves RGB and encodes 40 percent opacity', () => {
  assert.equal(brushColor('#eab308', 'highlighter'), '#eab30866');
  assert.equal(brushColor('#253631', 'pen'), '#253631');
});

test('legacy and unsupported drawing orders fall back without resetting appearance', () => {
  for (const drawingOrder of [undefined, null, 'unknown', 1, {}]) {
    const parsed = parsePreferences(JSON.stringify({theme:'dark', drawingOrder}));
    assert.equal(parsed.theme, 'dark');
    assert.equal(parsed.drawingOrder, 'recent');
  }
  const saved = {...defaultPreferences, drawingOrder:'name'};
  assert.deepEqual(parsePreferences(JSON.stringify(saved)), saved);
});
