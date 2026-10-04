import { RecordingMeta } from '@/types/muse';
import { MM_CSV_HEADER } from './csvFormat';

const DB_NAME = 'MuseDatabase';
const STORE_NAME = 'recordings';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function list(): Promise<RecordingMeta[]> {
  const db = await openDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.map((r: { meta: RecordingMeta }) => r.meta));
  });
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve(void 0);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function exportCsv(id: string): Promise<string> {
  const db = await openDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => {
      const session = request.result;
      if (!session) { resolve(''); return; }
      const blob = new Blob([session.rows.join('\n')], { type: 'text/csv' });
      resolve(URL.createObjectURL(blob));
    };
  });
}

export async function share(id: string): Promise<void> {
  const url = await exportCsv(id);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recording_${id}.csv`;
  a.click();
}

export async function saveWebSession(id: string, meta: RecordingMeta, rows: string[]) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({
      id,
      meta,
      rows: [MM_CSV_HEADER, ...rows]
    });
    transaction.oncomplete = () => resolve(void 0);
    transaction.onerror = () => reject(transaction.error);
  });
}
