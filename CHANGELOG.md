# Changelog

No published releases yet. Package version 0.1.0 is a development version.

## Unreleased

### SDK

- TypeScript Canvas 2D engine with adaptive smoothing, radius following, pressure and velocity width.
- Whole-stroke erasing, undo/redo, replay, and PNG/SVG/JSON export.
- Versioned JSON validation and content-cropped image export.
- Incremental sample processing, bounded geometry caches, streaming fallback and opaque raster-prefix rendering.
- ESM declarations and isolated tarball consumer checks; no runtime dependencies.

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
- UMD output and Worker flood fill are not implemented.
- Package identity, license, publishing and public deployment remain pending.
