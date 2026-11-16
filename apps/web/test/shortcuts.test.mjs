import test from 'node:test';
import assert from 'node:assert/strict';
import {shortcutFor, consumeShortcut} from '../src/shortcuts.ts';
const key = (key, options={}) => ({key,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,isComposing:false,repeat:false,defaultPrevented:false,...options});
test('save supports Control and Meta without stealing Save As',()=>{
  assert.equal(shortcutFor(key('s',{ctrlKey:true})),'save');
  assert.equal(shortcutFor(key('S',{metaKey:true})),'save');
  assert.equal(shortcutFor(key('s',{metaKey:true,shiftKey:true})),undefined);
  assert.equal(shortcutFor(key('s')),undefined);
});
test('editing shortcuts retain platform history and tool mappings',()=>{
  assert.equal(shortcutFor(key('z',{metaKey:true})),'undo');
  assert.equal(shortcutFor(key('z',{ctrlKey:true,shiftKey:true})),'redo');
  assert.equal(shortcutFor(key('y',{ctrlKey:true})),'redo');
  assert.equal(shortcutFor(key('y',{metaKey:true})),undefined);
  for(const [letter,command] of [['b','pen'],['e','eraser'],['h','hand']])assert.equal(shortcutFor(key(letter)),command);
});
test('composition, Alt and consumed events never trigger commands',()=>{
  for(const flag of ['isComposing','altKey','defaultPrevented']) {
    assert.equal(shortcutFor(key('s',{ctrlKey:true,[flag]:true})),undefined);
    assert.equal(shortcutFor(key('b',{[flag]:true})),undefined);
  }
});

test('recognized repeats suppress browser defaults without repeating actions', () => {
  for (const [letter, options, command] of [
    ['s', {ctrlKey:true}, 'save'], ['s', {metaKey:true}, 'save'],
    ['z', {ctrlKey:true}, 'undo'], ['b', {}, 'pen'],
  ]) {
    let prevented = 0;
    const event = {...key(letter, options), preventDefault() { prevented++; }};
    assert.equal(consumeShortcut(event), command);
    assert.equal(consumeShortcut({...event, repeat:true}), undefined);
    assert.equal(prevented, 2);
  }
  for (const options of [{shiftKey:true}, {isComposing:true}, {altKey:true}, {defaultPrevented:true}]) {
    let prevented = false;
    assert.equal(consumeShortcut({...key('s', {ctrlKey:true, ...options}), preventDefault() { prevented = true; }}), undefined);
    assert.equal(prevented, false);
  }
});
