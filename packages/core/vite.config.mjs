import { fileURLToPath } from 'node:url';

export default {
  build: {
    target: 'es2022',
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'CalamusSDK',
      formats: ['umd'],
      fileName: () => 'calamus.umd.cjs',
    },
  },
};
