export type Drawing = { id: string; name: string; json: string; updatedAt: number; deletedAt?: number };
export interface DrawingStore {
  read(): Promise<{ drawings: Drawing[]; activeId?: string }>;
  save(drawing: Drawing): Promise<void>;
  select(id: string): Promise<void>;
  replaceSelection(drawing: Drawing, next: Drawing): Promise<void>;
}

/** Each queued write owns its document ID and snapshot. */
export function createLibrary(store: DrawingStore) {
  let drawings: Drawing[] = [];
  let activeId = '';
  let queue = Promise.resolve();
  const enqueue = (action: () => Promise<void>) => {
    const task = queue.catch(() => {}).then(action);
    queue = task;
    return task;
  };
  const current = () => {
    const drawing = drawings.find(item => item.id === activeId);
    if (!drawing) throw new Error('No drawing is open.');
    return { ...drawing };
  };
  return {
    current,
    list: () => drawings.filter(item => item.deletedAt === undefined).map(item => ({ ...item })),
    trash: () => drawings.filter(item => item.deletedAt !== undefined).map(item => ({ ...item })),
    async restore(emptyJSON: string) {
      const saved = await store.read();
      drawings = saved.drawings;
      if (!drawings.some(item => item.deletedAt === undefined)) {
        const drawing = { id: crypto.randomUUID(), name: 'Untitled drawing', json: emptyJSON, updatedAt: Date.now() };
        await store.save(drawing);
        drawings = [...drawings, drawing];
      }
      activeId = drawings.some(item => item.id === saved.activeId && item.deletedAt === undefined) ? saved.activeId! : drawings.find(item => item.deletedAt === undefined)!.id;
      await store.select(activeId);
      return current();
    },
    save(json: string) {
      const drawing = { ...current(), json, updatedAt: Date.now() };
      drawings = drawings.map(item => item.id === drawing.id ? drawing : item);
      return enqueue(() => store.save(drawing));
    },
    async open(id: string) {
      await queue;
      const drawing = drawings.find(item => item.id === id && item.deletedAt === undefined);
      if (!drawing) throw new Error('Drawing no longer exists.');
      await store.select(id);
      activeId = id;
      return { ...drawing };
    },
    async create(emptyJSON: string) {
      await queue;
      const drawing = { id: crypto.randomUUID(), name: 'Untitled drawing', json: emptyJSON, updatedAt: Date.now() };
      await store.save(drawing);
      // Keep a successfully saved drawing discoverable even if selection fails.
      drawings = [...drawings, drawing];
      await store.select(drawing.id);
      activeId = drawing.id;
      return { ...drawing };
    },
    async duplicate() {
      await queue;
      const source = current();
      const drawing = { ...source, id: crypto.randomUUID(), name: `${source.name.slice(0, 73)} (copy)`, updatedAt: Date.now() };
      await store.save(drawing);
      drawings = [...drawings, drawing];
      await store.select(drawing.id);
      activeId = drawing.id;
      return { ...drawing };
    },
    async remove(emptyJSON: string) {
      await queue;
      const removed = { ...current(), deletedAt: Date.now() };
      // Open a known-valid blank drawing instead of risking a corrupt successor.
      const next = { id: crypto.randomUUID(), name: 'Untitled drawing', json: emptyJSON, updatedAt: Date.now() };
      await store.replaceSelection(removed, next);
      drawings = [...drawings.map(item => item.id === removed.id ? removed : item), next];
      activeId = next.id;
      return { ...next };
    },
    async recover(id: string) {
      await queue;
      const source = drawings.find(item => item.id === id && item.deletedAt !== undefined);
      if (!source) throw new Error('Deleted drawing no longer exists.');
      const { deletedAt, ...drawing } = source;
      await store.save(drawing);
      drawings = drawings.map(item => item.id === id ? drawing : item);
      return current();
    },
    async rename(name: string) {
      const cleaned = name.trim();
      if (!cleaned || cleaned.length > 80) throw new Error('Use a name between 1 and 80 characters.');
      await queue;
      const drawing = { ...current(), name: cleaned, updatedAt: Date.now() };
      await store.save(drawing);
      drawings = drawings.map(item => item.id === drawing.id ? drawing : item);
      return { ...drawing };
    },
  };
}

/** Match names without changing library order or the selected drawing. */
export function filterDrawings(drawings: readonly Drawing[], query: string): Drawing[] {
  const search = query.normalize('NFKC').trim().toLowerCase();
  return drawings.filter(drawing => drawing.name.normalize('NFKC').toLowerCase().includes(search));
}
