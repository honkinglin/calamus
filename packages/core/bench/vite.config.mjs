import { fileURLToPath } from 'node:url';

// Build both standalone diagnostics so missing imports and HTML entry errors
// are caught even when the main playground does not import these pages.
export default {
  build: {
    rollupOptions: {
      input: {
        engine: fileURLToPath(new URL('./engine-browser.html', import.meta.url)),
        path: fileURLToPath(new URL('./path-browser.html', import.meta.url)),
      },
    },
  },
};
