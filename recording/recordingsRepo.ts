import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { RecordingMeta } from '@/types/muse';
import { MM_CSV_HEADER } from './csvFormat';

/**
 * Repositorio de grabaciones — lista, elimina, exporta y comparte.
 */
export async function list(): Promise<RecordingMeta[]> {
  const recordingsDir = `${FileSystem.documentDirectory}recordings/`;

  try {
    const dirs = await FileSystem.readDirectoryAsync(recordingsDir);
    const metas: RecordingMeta[] = [];

    for (const dir of dirs) {
      const metaPath = `${recordingsDir}${dir}/meta.json`;
      try {
        const content = await FileSystem.readAsStringAsync(metaPath);
        metas.push(JSON.parse(content));
      } catch {
        // Si no hay meta.json, ignorar
      }
    }

    return metas;
  } catch {
    return [];
  }
}

export async function delete(id: string): Promise<void> {
  const dir = `${FileSystem.documentDirectory}recordings/${id}/`;
  await FileSystem.deleteAsync(dir, { idempotent: true });
}

/**
 * Concatena cabecera + partes y escribe un CSV en cacheDirectory.
 * Devuelve el URI del archivo exportado.
 */
export async function exportCsv(id: string): Promise<string> {
  const dir = `${FileSystem.documentDirectory}recordings/${id}/`;
  const metaPath = `${dir}meta.json`;

  const metaContent = await FileSystem.readAsStringAsync(metaPath);
  const meta: RecordingMeta = JSON.parse(metaContent);

  // Leer todas las partes
  const files = await FileSystem.readDirectoryAsync(dir);
  const partFiles = files
    .filter((f) => f.startsWith('part-') && f.endsWith('.csv'))
    .sort();

  const parts: string[] = [MM_CSV_HEADER];
  for (const part of partFiles) {
    const content = await FileSystem.readAsStringAsync(`${dir}${part}`);
    parts.push(content);
  }

  // Escribir CSV en cacheDirectory
  const outputUri = `${FileSystem.cacheDirectory}${meta.fileName}`;
  await FileSystem.writeAsStringAsync(outputUri, parts.join('\n'));

  return outputUri;
}

/**
 * Exporta y comparte el CSV.
 */
export async function share(id: string): Promise<void> {
  const uri = await exportCsv(id);
  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
}
