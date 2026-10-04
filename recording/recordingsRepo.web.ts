import { RecordingMeta } from '@/types/muse';
import { MM_CSV_HEADER } from './csvFormat';

const STORAGE_KEY = 'muse_recordings';

// Inicializar desde localStorage
const loadRecordings = (): Record<string, { meta: RecordingMeta, data: string[] }> => {
  if (typeof window === 'undefined') return {};
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
};

const sessionRecordings = loadRecordings();

const saveToStorage = () => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionRecordings));
    } catch (e) {
      console.warn('[recordingsRepo] localStorage quota exceeded:', e);
      // Si excede cuota, guardar solo metadatos sin datos crudos
      const metaOnly: Record<string, any> = {};
      for (const [k, v] of Object.entries(sessionRecordings)) {
        metaOnly[k] = { meta: v.meta };
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(metaOnly));
    }
  }
};

export async function list(): Promise<RecordingMeta[]> {
  return Object.values(sessionRecordings).map(s => s.meta);
}

export async function deleteRecording(id: string): Promise<void> {
  const next = { ...sessionRecordings };
  delete next[id];
  // Persist before mutating memory. Never use the metadata-only fallback when deleting:
  // it could silently discard CSV data from other sessions.
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  delete sessionRecordings[id];
}

export async function exportCsv(id: string): Promise<string> {
  const session = sessionRecordings[id];
  if (!session) return '';

  const blob = new Blob([session.data.join('\n')], { type: 'text/csv' });
  return URL.createObjectURL(blob);
}

export async function share(id: string): Promise<void> {
  const url = await exportCsv(id);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recording_${id}.csv`;
  a.click();
}

export function saveWebSession(id: string, meta: RecordingMeta, rows: string[]) {
  sessionRecordings[id] = { meta, data: [MM_CSV_HEADER, ...rows] };
  saveToStorage();
}
