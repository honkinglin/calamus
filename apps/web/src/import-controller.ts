/** Serializes import intent without blocking editing while a file is read. */
export function createImportController(options: {
  revision: () => number;
  load: (json: string) => void;
  notify: (message: string) => void;
}) {
  let request = 0;
  let disposed = false;
  return {
    dispose() { disposed = true; request++; },
    async read(file: { size: number; text: () => Promise<string> }) {
      if (disposed) return;
      const current = ++request;
      const revision = options.revision();
      const active = () => !disposed && current === request;
      options.notify('Reading drawing…');
      try {
        if (file.size > 20_000_000) throw new Error('Document exceeds 20 MB.');
        const json = await file.text();
        if (!active()) return;
        if (options.revision() !== revision) {
          options.notify('Drawing changed while reading the file. Import again to replace it.');
          return;
        }
        options.load(json);
        options.notify('Drawing imported. Use Undo to restore your previous drawing.');
      } catch (error) {
        if (active()) options.notify(error instanceof Error ? error.message : 'Unable to import drawing.');
      }
    },
  };
}
