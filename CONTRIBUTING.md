# Contributing to Calamus

Calamus is under active development. Start with the [development plan](docs/DEVELOPMENT_PLAN.md), [architecture](docs/ARCHITECTURE.md), and [current limitations](README.md#current-boundaries). Package naming and licensing are still release tasks; do not assume a published package or finalized contribution license.

## Local setup

Use Node.js 22.12+ and pnpm 10.15.1:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`packages/core` owns drawing semantics and must stay independent of React. `apps/web` owns the playground and local persistence. `examples/vanilla` demonstrates the public SDK against an actual packed artifact.

## Making a change

1. Describe the concrete behavior or bug. For a substantial API or data-format change, discuss the proposed contract before implementation.
2. Keep raw stroke data separate from derived geometry and rendering caches. Preserve import validation and document/history behavior.
3. Add regression coverage for meaningful behavior changes. Do not replace browser pixel checks with mocked Canvas commands.
4. Update relevant API, data-format or example documentation when public behavior changes.
5. Describe validation and remaining limitations in the pull request.

Do not edit generated `dist`, example `vendor`, or temporary tarballs. Do not include local drawing databases, credentials or personal handwriting samples in contributions. Use synthetic input for reproducible failures.

## Validation

| Change | Checks |
| --- | --- |
| SDK behavior | `pnpm test`, `pnpm build`, `pnpm check:package` |
| Public exports or declarations | `pnpm check:package`, `pnpm example:build`, `pnpm size` |
| Playground behavior | `pnpm test`, `pnpm build`, relevant browser interactions |
| Browser diagnostics | `pnpm build:diagnostics`, run both diagnostic pages in a browser |
| Example | `pnpm example:build`, browser workflow checks |
| Documentation | Verify links, commands and examples against the current API |

`pnpm check` includes strict diagnostics type checking. CI builds both diagnostic HTML entry points through `pnpm build:diagnostics`; this does not execute browser pixel or interaction checks. Generated files stay in `packages/core/bench/dist` and are not part of the published SDK.

Every `ts` fenced example in the packaged core README is compiled against the installed declarations in NodeNext and Bundler modes. Keep snippets self-contained; declare inputs through function parameters rather than relying on unstated globals.

`pnpm check:package` also runs the installed ESM and UMD engines with a deterministic Canvas/rAF fixture, comparing replay commands, pause/resume, cancellation, document/history preservation and teardown. This validates installed artifacts; the fixture does not replace real-browser pixel or performance checks. The existing `example:build` CI step invokes this package verification as well.

For rendering changes, compare opaque and translucent self-intersections, pressure changes, DPR/resize, cancellation, undo/redo, replay and exports. Record which browsers and devices you actually tested. Mark untested cases explicitly.

Performance reports should include environment, input, warmup, repetitions and raw samples. Distinguish JavaScript computation, Canvas command submission, display intervals and input latency. See [performance notes](docs/PERFORMANCE.md).

## Pull requests

Keep changes focused and explain the final behavior. Use the PR template to record tests and gaps. Add a concise entry under Unreleased in [CHANGELOG.md](CHANGELOG.md) for user-visible behavior or package changes. Changes to document formats require an explicit compatibility/migration plan.

Submitting a pull request does not authorize publication or deployment. Release work follows the [release checklist](docs/RELEASE_CHECKLIST.md).
