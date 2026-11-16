export type Shortcut = 'undo' | 'redo' | 'pen' | 'eraser' | 'hand' | 'save';
type Key = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'isComposing' | 'repeat' | 'defaultPrevented'>;

export function shortcutFor(event: Key): Shortcut | undefined {
  if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey) return;
  const key = event.key.toLowerCase();
  if (event.metaKey || event.ctrlKey) {
    if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
    if (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey) return 'redo';
    if (key === 's' && !event.shiftKey) return 'save';
    return;
  }
  if (!event.shiftKey) return ({b:'pen',e:'eraser',h:'hand'} as const)[key as 'b'|'e'|'h'];
}
