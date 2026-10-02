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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionRecordings));
  }
};

export async function list(): Promise<RecordingMeta[]> {
  return Object.values(sessionRecordings).map(s => s.meta);
}

export async function deleteRecording(id: string): Promise<void> {
  delete sessionRecordings[id];
  saveToStorage();
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
