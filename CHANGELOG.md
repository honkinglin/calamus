# Changelog

No published releases yet. Package version 0.1.0 is a development version.

## Unreleased

### Web

- Drawing sort preference is saved locally with safe defaults for older settings and a session-only warning when storage fails.

- Drawing cards place the current-document badge below the name to improve long-name wrapping on narrow screens.

- Drawing library defaults to recently modified order and offers natural name sorting alongside search, without changing the active document.

- Drawing library search supports normalized name matching, result counts, empty states and clearing without changing the active drawing.

- Held shortcuts suppress browser defaults without repeating exports or drawing commands.

- Ctrl/Cmd+S exports a named JSON backup from the drawing workspace; shortcut handling respects consumed events, composition, editable controls and dialogs.

- PNG, SVG and JSON downloads use the current drawing name with portable filename sanitization, Unicode support and a bounded UTF-8 length. PNG captures the name before asynchronous rendering.

### SDK

- Active translucent strokes reuse a bounded incremental Path2D while retaining one nonzero fill per frame; unsupported environments and oversized geometry fall back to the existing renderer. Browser pixel/performance acceptance remains pending.

- TypeScript Canvas 2D engine with adaptive smoothing, radius following, pressure and velocity width.
- Whole-stroke erasing, undo/redo, replay, and PNG/SVG/JSON export.
- Versioned JSON validation and content-cropped image export.
- Incremental sample processing, bounded geometry caches, streaming fallback and opaque raster-prefix rendering.
- ESM declarations, standalone UMD (`CalamusSDK`) and isolated tarball consumer checks; no runtime dependencies.

### Fixed

- The vanilla and classic-script examples preserve explicitly destroyed instances across back/forward cache restores; only instances active before navigation resume automatically.

- Corrected the Calamus wordmark and centered Stroke lab in the viewport, with a persistent icon close button, scrollable content, and reduced-motion-aware enter/exit transitions.

- Live drawing now enforces document stroke/point capacity and reports rejected gestures via `onInputLimit`. Existing drawings and history survive overflow; erasing remains available and retains only its latest sweep endpoint. Playground and vanilla example show capacity feedback.

- Invalid pointer samples and zero-sized canvas bounds no longer enter committed strokes. Invalid in-progress input cancels the gesture (including provisional erasures); regressing event timestamps are normalized to preserve document ordering.

- Engine destruction now completes resource cleanup before notifying host replay callbacks, so a callback exception cannot interrupt teardown. Repeated/reentrant destruction is inert and committed raster backing storage is released.

### Changed

- Live brush configuration now uses the same validation as imported documents: hexadecimal colors only, width 0.01–4096, follow radius 0–4096 and boolean velocity width. Previously accepted out-of-contract settings now throw without replacing the brush. Logical canvas dimensions are restricted to 1–32768.
- Updating a brush after destroying its engine now throws.

### Playground and examples

- Tailwind-based studio interface with a compact icon toolbar, document header, export menu, brush preview, collapsible controls and coordinated light/dark styling. Browser visual acceptance remains pending.

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
