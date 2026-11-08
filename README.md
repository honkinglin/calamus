# Calamus

A canvas drawing playground and a dependency-free TypeScript drawing SDK.

[中文说明](README.zh-CN.md) · [SDK API](docs/API.md) · [Document format](docs/DOCUMENT_FORMAT.md) · [Architecture](docs/ARCHITECTURE.md) · [Development plan](docs/DEVELOPMENT_PLAN.md)

## What works today

- Adaptive smoothing, radius following, pen pressure and velocity-based width.
- Whole-stroke erasing, undo/redo, replay with pause and speed control.
- PNG, SVG and JSON export, with optional content cropping for image exports.
- A React playground with local drawing storage, recoverable deletion, zoom/pan, themes and a stroke parameter lab.
- An ESM SDK with declarations, no runtime dependencies, and a [plain JavaScript example](examples/vanilla/README.md).

The project is in development. The package name is provisional and publishing is disabled with `private: true`. No public npm release or hosted deployment is claimed. CommonJS/UMD output and Worker flood fill are not implemented. Package identity and license selection remain release tasks.

## Run locally

Use Node.js 22.12 or newer and pnpm 10.15.1.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the address printed by Vite. For the standalone SDK example:

```sh
pnpm example:vanilla
```

The example builds, packs and installs the real SDK tarball before preparing its local assets. It does not import SDK source files.

## Integrate the SDK

For local installation instructions, see the [package README](packages/core/README.md). Attach a canvas with a nonzero CSS size before constructing the engine:

```ts
import { Calamus } from '@calamus/core';

const canvas = document.querySelector<HTMLCanvasElement>('#drawing')!;
const drawing = new Calamus(canvas, {
  width: 1000,
  height: 700,
  brush: { color: '#253631', size: 6, smoothing: 0.55, stabilizer: 8 },
});

// Bind these to your own controls.
drawing.undo();
const json = drawing.exportJSON();
const png = await drawing.exportPNG({ scale: 2 });

// Release input listeners, observers and gesture caches on unmount.
drawing.destroy();
```

Importing the SDK and using pure document/geometry functions does not require a DOM. Creating an engine requires browser Canvas 2D, Pointer Events, ResizeObserver and matchMedia. Persistence belongs to the host application; the SDK does not upload or auto-save documents.

## Check and build

| Command | Purpose |
| --- | --- |
| `pnpm test` | Core and web logic tests |
| `pnpm build` | SDK and playground production builds |
| `pnpm check:package` | Actual tarball installation, DOM-free ESM and strict TS/JS consumers |
| `pnpm example:build` | Package checks plus standalone example build |
| `pnpm size` | Packed file inventory and size report |
| `pnpm bench` | Node stroke-processing and geometry benchmarks |

Additional benchmarks and their limits are documented in [PERFORMANCE.md](docs/PERFORMANCE.md). Node timings and mock rendering checks are not browser input-latency measurements.

## Current boundaries

Transparent dense paths can still be expensive. Recent rendering optimizations await browser pixel/performance regression checks. Real touch/stylus and cross-browser acceptance remain open. The playground stores drawings locally; multi-tab conflict merging and cloud sync are not implemented. Exported documents contain committed strokes, not unfinished gestures.

See [progress](docs/PROGRESS.md) for completed increments and pending acceptance, and [architecture](docs/ARCHITECTURE.md) for ownership and rendering details.

[Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [Release checklist](docs/RELEASE_CHECKLIST.md)
