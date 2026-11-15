import test from 'node:test';
import assert from 'node:assert/strict';
import { exportFilename } from '../src/export-filename.ts';

test('exports keep readable drawing names and explicit formats', () => {
  for (const format of ['png', 'svg', 'json']) assert.equal(exportFilename(' 春日 草图 🎨 ', format), `春日 草图 🎨.${format}`);
  assert.equal(exportFilename('Cafe\u0301', 'png'), 'Café.png');
});
test('filenames remove path separators, controls and misleading direction marks', () => {
  assert.equal(exportFilename('../sketch\\draft:1?\n\u202e', 'json'), '-sketch-draft-1---.json');
  for (const value of [undefined, '', '  ', '...']) assert.equal(exportFilename(value, 'svg'), 'calamus.svg');
  assert.equal(exportFilename('sketch. ', 'png'), 'sketch.png');
});
test('Windows device names are safe even with an existing extension', () => {
  for (const name of ['CON', 'nul.txt', 'COM1', 'lpt9']) assert.equal(exportFilename(name, 'png'), `_${name}.png`);
  assert.equal(exportFilename('contest', 'svg'), 'contest.svg');
});
test('long Unicode names stay within byte limits without splitting code points', () => {
  const result = exportFilename('🎨'.repeat(100), 'json');
  assert.equal(result, '🎨'.repeat(45) + '.json');
  assert.ok(new TextEncoder().encode(result).length < 255);
});
