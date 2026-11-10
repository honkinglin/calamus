# Changelog

No published releases yet. Package version 0.1.0 is a development version.

## Unreleased

### SDK

- TypeScript Canvas 2D engine with adaptive smoothing, radius following, pressure and velocity width.
- Whole-stroke erasing, undo/redo, replay, and PNG/SVG/JSON export.
- Versioned JSON validation and content-cropped image export.
- Incremental sample processing, bounded geometry caches, streaming fallback and opaque raster-prefix rendering.
- ESM declarations, standalone UMD (`CalamusSDK`) and isolated tarball consumer checks; no runtime dependencies.

### Changed

- Live brush configuration now uses the same validation as imported documents: hexadecimal colors only, width 0.01–4096, follow radius 0–4096 and boolean velocity width. Previously accepted out-of-contract settings now throw without replacing the brush. Logical canvas dimensions are restricted to 1–32768.
- Updating a brush after destroying its engine now throws.

### Playground and examples

- Local drawing library, recoverable deletion, zoom/pan, themes and brush presets.
- Stroke parameter lab and reproducible performance reports.
- Plain JavaScript example with export and engine lifecycle controls.

### Developer experience

- pnpm workspace, build/test CI, package-size reports and actual package consumer verification.
- Bilingual overview, API/data-format/architecture documentation and contribution templates.
- Packed-file allowlist checks reject unexpected archive contents before consumer installation.

### Known gaps

- Browser regression for recent rendering changes, real touch/stylus and cross-browser acceptance remain incomplete.
- Transparent dense paths may still be expensive.
- Worker flood fill is not implemented; UMD browser rendering acceptance remains pending.
- Package identity, license, publishing and public deployment remain pending.
