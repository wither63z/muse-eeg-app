import type { RecordingMeta } from '@/types/muse';
import { RAW_CSV_HEADER } from './csvFormat';

type Session = { id: string; meta: RecordingMeta; rows: string[] };
const LEGACY_KEY = 'muse_recordings';
/** Commits resolve only after the IndexedDB transaction completes. Errors propagate. */
async function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, deleted: IDBObjectStore, result: (value: T) => void) => void,
): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('MuseDatabase', 2);
    request.onupgradeneeded = () => {
      for (const name of ['recordings', 'deleted'])
        if (!request.result.objectStoreNames.contains(name))
          request.result.createObjectStore(name, { keyPath: 'id' });
    };
    request.onerror = () => reject(request.error);
    let blocked = false;
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Cierra otras pestañas de Muse Open Monitor y vuelve a intentar.'));
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(['recordings', 'deleted'], mode);
    let value: T;
    tx.oncomplete = () => {
      db.close();
      resolve(value);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error || new Error('No se pudo guardar en este navegador.'));
    };
    try {
      run(tx.objectStore('recordings'), tx.objectStore('deleted'), (next) => {
        value = next;
      });
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}
async function migrate(): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  const text = localStorage.getItem(LEGACY_KEY);
  if (!text) return;
  const legacy: unknown = JSON.parse(text);
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy))
    throw new Error('Las grabaciones anteriores no tienen un formato válido.');
  await transaction<void>('readwrite', (store, deleted) => {
    for (const [id, item] of Object.entries(legacy)) {
      if (
        !item ||
        typeof item !== 'object' ||
        !('meta' in item) ||
        !('data' in item) ||
        !Array.isArray(item.data) ||
        !item.data.every((r: unknown) => typeof r === 'string')
      )
        continue;
      const meta = item.meta;
      if (!meta || typeof meta !== 'object' || !('id' in meta) || meta.id !== id) continue;
      const existing = store.get(id),
        tombstone = deleted.get(id);
      let checked = 0;
      const save = () => {
        if (++checked === 2 && !existing.result && !tombstone.result)
          store.put({ id, meta, rows: item.data });
      };
      existing.onsuccess = save;
      tombstone.onsuccess = save;
    }
  });
}
export async function list(): Promise<RecordingMeta[]> {
  await migrate();
  return transaction<RecordingMeta[]>('readonly', (store, _, done) => {
    const request = store.getAll();
    request.onsuccess = () =>
      done(
        (request.result as Session[])
          .map((s) => s.meta)
          .sort((a, b) => b.startedAtMs - a.startedAtMs),
      );
  });
}
export async function saveWebSession(
  id: string,
  meta: RecordingMeta,
  rows: string[],
): Promise<void> {
  await transaction<void>('readwrite', (store, deleted) => {
    deleted.delete(id);
    store.put({ id, meta, rows: [RAW_CSV_HEADER, ...rows] });
  });
}
export async function deleteRecording(id: string): Promise<void> {
  await transaction<void>('readwrite', (store, deleted) => {
    store.delete(id);
    deleted.put({ id });
  });
  // Delete the selected legacy source too. Never discard another recording.
  if (typeof localStorage !== 'undefined') {
    const text = localStorage.getItem(LEGACY_KEY);
    if (text) {
      const old = JSON.parse(text);
      delete old[id];
      localStorage.setItem(LEGACY_KEY, JSON.stringify(old));
    }
  }
}
export async function exportCsv(id: string): Promise<string> {
  await migrate();
  const session = await transaction<Session | undefined>('readonly', (store, _, done) => {
    const request = store.get(id);
    request.onsuccess = () => done(request.result);
  });
  if (!session) throw new Error('No se encontró la grabación.');
  return URL.createObjectURL(
    new Blob([session.rows.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' }),
  );
}
export async function share(id: string): Promise<void> {
  const url = await exportCsv(id),
    anchor = document.createElement('a');
  try {
    anchor.href = url;
    anchor.download = `muse_${id}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
