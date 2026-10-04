import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { RecordingMeta } from '@/types/muse';
import { MM_CSV_HEADER } from './csvFormat';

/**
 * Repositorio de grabaciones — lista, elimina, exporta y comparte.
 * En web, todas las operaciones son no-op porque expo-file-system y expo-sharing no están disponibles.
 */
export async function list(): Promise<RecordingMeta[]> {
  if (Platform.OS === 'web') {
    return [];
  }

  const recordingsDir = `${FileSystem.documentDirectory}recordings/`;

  try {
    // Asegurarse de que el directorio existe
    const dirInfo = await FileSystem.getInfoAsync(recordingsDir);
    if (!dirInfo.exists || !dirInfo.isDirectory) {
      return [];
    }

    const files = await FileSystem.readDirectoryAsync(recordingsDir);
    const metas: RecordingMeta[] = [];

    for (const file of files) {
      const metaFileUri = `${recordingsDir}${file}/meta.json`;
      try {
        const content = await FileSystem.readAsStringAsync(metaFileUri);
        metas.push(JSON.parse(content));
      } catch {
        // Si no se puede leer, ignorar
      }
    }

    return metas;
  } catch {
    return [];
  }
}

export async function deleteRecording(id: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const dir = `${FileSystem.documentDirectory}recordings/${id}/`;
  try {
    await FileSystem.deleteAsync(dir, { idempotent: true });
  } catch {
    // Ignorar errores si el directorio ya no existe
  }
}

/**
 * Concatena cabecera + partes y escribe un CSV en cacheDirectory.
 * Devuelve el URI del archivo exportado.
 */
export async function exportCsv(id: string): Promise<string> {
  if (Platform.OS === 'web') {
    console.warn('CSV export not implemented for web yet');
    return '';
  }

  const dir = `${FileSystem.documentDirectory}recordings/${id}/`;
  const metaFileUri = `${dir}meta.json`;

  const metaContent = await FileSystem.readAsStringAsync(metaFileUri);
  const meta: RecordingMeta = JSON.parse(metaContent);

  const parts: string[] = [];
  try {
    const files = await FileSystem.readDirectoryAsync(dir);
    const partFiles = files
      .filter((f) => f.startsWith('part-') && f.endsWith('.csv'))
      .sort();

    for (const file of partFiles) {
      const content = await FileSystem.readAsStringAsync(`${dir}${file}`);
      parts.push(content);
    }
  } catch {
    // Si no podemos leer partes, devolvemos solo la cabecera
  }

  const outputFileUri = `${FileSystem.cacheDirectory}${meta.fileName}`;
  await FileSystem.writeAsStringAsync(outputFileUri, parts.join('\n'));

  return outputFileUri;
}

/**
 * Exporta y comparte el CSV.
 */
export async function share(id: string): Promise<void> {
  if (Platform.OS === 'web') {
    // En web, no podemos compartir archivos del sistema de archivos nativos.
    // Podríamos generar un Blob y usar el API de compartir de web si está disponible,
    // pero por ahora es un no-op.
    return;
  }

  const uri = await exportCsv(id);
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');

  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
}