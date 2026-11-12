import { Calamus } from '@calamus/core';

const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#drawing'));
const tool = /** @type {HTMLSelectElement} */ (document.querySelector('#tool'));
const color = /** @type {HTMLInputElement} */ (document.querySelector('#color'));
const size = /** @type {HTMLInputElement} */ (document.querySelector('#size'));
const stability = /** @type {HTMLSelectElement} */ (document.querySelector('#stability'));
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
/** @param {string} id */
const button = id => /** @type {HTMLButtonElement} */ (document.getElementById(id));
/** @type {Calamus | null} */
let engine = null;
let exporting = false;
let snapshot = '';

function sync() {
  const state = engine?.state;
  button('undo').disabled = !state?.undo;
  button('redo').disabled = !state?.redo;
  for (const id of ['clear', 'png', 'svg', 'json']) button(id).disabled = !engine || exporting;
  for (const control of [tool, color, size, stability]) control.disabled = !engine;
  button('lifecycle').disabled = exporting;
  button('lifecycle').textContent = engine ? 'Destroy instance' : 'Create instance';
}
function brush() {
  engine?.setBrush({ color: color.value, size: Number(size.value),
    smoothing: stability.value === 'smooth' ? 0.55 : 0,
    stabilizer: stability.value === 'follow' ? 12 : 0 });
}
function mount() {
  engine = new Calamus(canvas, { width: 1000, height: 700,
    onInputLimit: limit => { status.textContent = `Drawing ${limit} limit reached. New stroke cancelled; undo, erase or clear to continue.`; },
    onChange: () => {
    sync(); status.textContent = `${engine?.state.strokes ?? 0} completed strokes.`;
  } });
  if (snapshot) engine.loadJSON(snapshot, { resetHistory: true });
  engine.setTool(tool.value === 'eraser' ? 'eraser' : 'pen');
  brush(); sync(); status.textContent = 'Ready to draw.';
}
/** @param {Blob} blob @param {string} name */
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** @param {'png' | 'svg' | 'json'} format */
async function save(format) {
  if (!engine || exporting) return;
  exporting = true; sync();
  try {
    const blob = format === 'png' ? await engine.exportPNG({ background: '#fffef9' })
      : new Blob([format === 'svg' ? engine.exportSVG() : engine.exportJSON()],
        { type: format === 'svg' ? 'image/svg+xml' : 'application/json' });
    download(blob, `calamus.${format}`); status.textContent = `${format.toUpperCase()} download requested.`;
  } catch (error) { status.textContent = error instanceof Error ? error.message : 'Export failed.'; }
  finally { exporting = false; sync(); }
}
tool.addEventListener('change', () => engine?.setTool(tool.value === 'eraser' ? 'eraser' : 'pen'));
for (const control of [color, size, stability]) control.addEventListener('input', brush);
button('undo').addEventListener('click', () => engine?.undo());
button('redo').addEventListener('click', () => engine?.redo());
button('clear').addEventListener('click', () => engine?.clear());
for (const format of /** @type {const} */ (['png', 'svg', 'json'])) button(format).addEventListener('click', () => void save(format));
button('lifecycle').addEventListener('click', () => {
  if (engine) {
    snapshot = engine.exportJSON(); engine.destroy(); engine = null; sync();
    status.textContent = 'Instance destroyed. Create again to restore completed strokes; undo history resets.';
  } else mount();
});
window.addEventListener('pagehide', () => {
  if (engine) { snapshot = engine.exportJSON(); engine.destroy(); engine = null; }
});
window.addEventListener('pageshow', event => { if (event.persisted && !engine) mount(); });
mount();
