export type Drawing = { id: string; name: string; json: string; updatedAt: number };
export interface DrawingStore {
  read(): Promise<{ drawings: Drawing[]; activeId?: string }>;
  save(drawing: Drawing): Promise<void>;
  select(id: string): Promise<void>;
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
    list: () => drawings.map(item => ({ ...item })),
    async restore(emptyJSON: string) {
      const saved = await store.read();
      drawings = saved.drawings;
      if (!drawings.length) {
        const drawing = { id: crypto.randomUUID(), name: 'Untitled drawing', json: emptyJSON, updatedAt: Date.now() };
        await store.save(drawing);
        drawings = [drawing];
      }
      activeId = drawings.some(item => item.id === saved.activeId) ? saved.activeId! : drawings[0].id;
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
      const drawing = drawings.find(item => item.id === id);
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
