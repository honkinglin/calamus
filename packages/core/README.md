# Calamus Core

A dependency-free TypeScript canvas drawing SDK with smoothing, pressure-aware strokes, undo/redo, replay, and PNG/SVG/JSON export.

## Development status

This package is a local development build. The `@calamus/core` name is provisional, `private: true` prevents accidental publication, and this repository does not claim an npm registry release. The root entry is ESM with TypeScript declarations. A standalone UMD bundle is available at `@calamus/core/umd`; CommonJS consumers can require that explicit subpath.

## Install a local build

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @calamus/core build
pnpm --filter @calamus/core pack --pack-destination /tmp/calamus-pack
```

Create the destination directory first. In your own application, install the generated `.tgz` file using `pnpm add /absolute/path/to/package.tgz`. Import from the package root; internal module paths are not supported public APIs.

## Browser integration

Give the canvas a CSS size, then construct the engine after it is attached to the page:

```html
<canvas id="drawing" style="width: 100%; height: 420px"></canvas>
```

```ts
import { Calamus } from '@calamus/core';

const canvas = document.querySelector<HTMLCanvasElement>('#drawing')!;
const drawing = new Calamus(canvas, {
  width: 1000,
  height: 700,
  brush: { color: '#253631', size: 6, smoothing: 0.55, stabilizer: 8 },
});

drawing.setTool('eraser');
drawing.setTool('pen');
drawing.undo();
drawing.redo();

const json = drawing.exportJSON();
const png = await drawing.exportPNG({ scale: 2 });
drawing.loadJSON(json);

// Call when unmounting or removing the canvas.
drawing.destroy();
```

The engine maps pointer coordinates into the logical document size and adapts the backing canvas to device pixel ratio. Constructing an engine requires a browser with Canvas 2D, Pointer Events, ResizeObserver, and matchMedia. Importing the package and calling its pure geometry/document functions does not require a DOM.

Exports contain committed strokes, not an unfinished gesture. Store the returned JSON or Blob in your application; the SDK does not upload or persist documents automatically. Brush configuration accepts only 3/4/6/8-digit hexadecimal colors, sizes 0.01–4096, and follow radii 0–4096. Logical canvas dimensions must be 1–32768. Invalid settings are rejected before replacing the current brush. Transparent strokes retain a single fill; very dense transparent paths can still be expensive.

## Replay and lifecycle

Create one engine per mounted canvas. The helper below loads a saved document, reports playback state, and returns controls for your own buttons:

```ts
import { Calamus } from '@calamus/core';

export function mountReplay(canvas: HTMLCanvasElement, json: string, status: HTMLElement) {
  const engine = new Calamus(canvas, {
    width: 1000,
    height: 700,
    onReplayChange: state => { status.textContent = state; },
  });
  try {
    // Opening a saved document establishes a new undo history.
    engine.loadJSON(json, { resetHistory: true });
  } catch (error) {
    engine.destroy();
    throw error;
  }
  status.textContent = 'idle';
  return {
    play: (speed = 1) => engine.play({ speed }),
    pause: () => engine.pauseReplay(),
    resume: () => engine.resumeReplay(),
    stop: () => engine.stopReplay(),
    dispose: () => engine.destroy(),
  };
}
```

Wire these controls to your UI, and call `dispose()` on unmount. Playback speed must be finite and between 0.25 and 4. Pausing preserves progress; resuming continues it; stopping restores the complete document. Playback does not change saved strokes or undo history. Calling `play()` again starts from the beginning. An empty document does not start playback. The state callback reports `playing`, `paused`, and `idle`; it is not a per-frame progress callback.

`loadJSON` requires the document dimensions to match the engine. Its default behavior is undoable replacement; use `{ resetHistory: true }` when opening a different saved work. Invalid documents throw before replacing current content. Wrap imports in application-level error handling so users can retry. `destroy()` cancels scheduled work and removes listeners; it is safe to call again, but create a new engine before drawing after disposal.

## Pure functions

```ts
import { createSVG, parseDocument, processStroke } from '@calamus/core';

export function inspectDocument(savedJSON: string) {
  const document = parseDocument(savedJSON);
  const svg = createSVG(document.strokes, document.width, document.height);
  const renderedPoints = document.strokes.map(processStroke);
  return { svg, renderedPoints };
}
```

Raw samples remain in the document; rendering derives smoothed coordinates and widths. `parseDocument` validates imported data and rejects unsupported document versions.

## Package verification

Run `pnpm check:package` in the repository. It builds and packs the SDK, installs the tarball into a temporary external consumer with pnpm offline, runs DOM-free ESM checks, compares installed ESM/UMD replay lifecycle behavior with a deterministic Canvas fixture, and validates strict TypeScript consumers and every TypeScript example in this packaged README in NodeNext and Bundler modes. Temporary files are removed afterwards. This does not publish the package or replace browser rendering tests.

## Classic script / UMD

Copy `dist/calamus.umd.cjs` from the installed package to your static assets. Serve it with a JavaScript MIME type (or rename the copied asset to `calamus.umd.js` when your static host does not recognize `.cjs`). Then use the exported namespace:

```html
<canvas id="drawing" style="width: 100%; height: 420px"></canvas>
<script src="./calamus.umd.js"></script>
<script>
  const drawing = new CalamusSDK.Calamus(document.querySelector('#drawing'));
  // Call drawing.destroy() when removing the canvas.
</script>
```

The bundle does not require a module loader or external runtime dependencies. It also supports AMD and `require('@calamus/core/umd')`. Use the root ESM entry for TypeScript declarations; the UMD subpath does not offer a separate typed CommonJS entry. Loader/pure-function checks run in Node; actual browser rendering acceptance remains pending.
