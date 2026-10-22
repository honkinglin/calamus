import type { Drawing, DrawingStore } from './library';

const DATABASE = 'calamus';
const WORKS = 'works';
const META = 'metadata';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      const works = db.createObjectStore(WORKS, { keyPath: 'id' });
      const metadata = db.createObjectStore(META);
      // Retain the old store as a migration backup. The upgrade is atomic.
      if (db.objectStoreNames.contains('documents')) {
        const legacy = request.transaction!.objectStore('documents').get('current');
        legacy.onsuccess = () => {
          if (typeof legacy.result !== 'string') return;
          works.put({ id: 'legacy', name: 'Untitled drawing', json: legacy.result, updatedAt: Date.now() });
          metadata.put('legacy', 'active');
        };
      }
    };
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      }
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Close other Calamus tabs and reload to upgrade storage.'));
    };
  });
}

async function transaction<T>(mode: IDBTransactionMode, run: (tx: IDBTransaction) => () => T): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction([WORKS, META], mode);
      tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted.'));
      tx.onerror = () => reject(tx.error);
      try {
        const result = run(tx);
        tx.oncomplete = () => resolve(result());
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  } finally {
    database.close();
  }
}

export const drawingStore: DrawingStore = {
  read: () => transaction('readonly', tx => {
    const works = tx.objectStore(WORKS).getAll();
    const active = tx.objectStore(META).get('active');
    return () => ({ drawings: works.result as Drawing[], activeId: active.result as string | undefined });
  }),
  save: drawing => transaction('readwrite', tx => {
    tx.objectStore(WORKS).put(drawing);
    return () => undefined;
  }),
  select: id => transaction('readwrite', tx => {
    tx.objectStore(META).put(id, 'active');
    return () => undefined;
  }),
};
