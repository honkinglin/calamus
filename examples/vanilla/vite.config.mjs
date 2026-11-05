import { fileURLToPath } from 'node:url';

// The dev server resolves the same packed artifact as the browser import map.
export default {
  resolve: { alias: { '@calamus/core': fileURLToPath(new URL('./vendor/index.js', import.meta.url)) } },
};
