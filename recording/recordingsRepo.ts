import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { RecordingMeta } from '@/types/muse';
import { MM_CSV_HEADER } from './csvFormat';

/**
 * Repositorio de grabaciones — lista, elimina, exporta y comparte.
 */
export async function list(): Promise<RecordingMeta[]> {
  const recordingsDir = new Directory(Paths.document, 'recordings');

  try {
    if (!recordingsDir.exists) {
      return [];
    }

    const dirs = recordingsDir.list();
    const metas: RecordingMeta[] = [];

    for (const dir of dirs) {
      if (dir instanceof Directory) {
        const metaFile = new File(dir, 'meta.json');
        if (metaFile.exists) {
          try {
            const content = metaFile.textSync();
            metas.push(JSON.parse(content));
          } catch {
            // Si no se puede leer, ignorar
          }
        }
      }
    }

    return metas;
  } catch {
    return [];
  }
}

export async function deleteRecording(id: string): Promise<void> {
  const dir = new Directory(Paths.document, 'recordings', id);
  if (dir.exists) {
    dir.delete();
  }
}

/**
 * Concatena cabecera + partes y escribe un CSV en cacheDirectory.
 * Devuelve el URI del archivo exportado.
 */
export async function exportCsv(id: string): Promise<string> {
  const dir = new Directory(Paths.document, 'recordings', id);
  const metaFile = new File(dir, 'meta.json');

  const metaContent = metaFile.textSync();
  const meta: RecordingMeta = JSON.parse(metaContent);

  // Leer todas las partes
  const parts: string[] = [MM_CSV_HEADER];
  const files = dir.list()
    .filter((f) => f.name.startsWith('part-') && f.name.endsWith('.csv'))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const part of files) {
    if (part instanceof File) {
      parts.push(part.textSync());
    }
  }

  // Escribir CSV en cacheDirectory
  const outputFile = new File(Paths.cache, meta.fileName);
  outputFile.create({ overwrite: true });
  outputFile.write(parts.join('\n'));

  return outputFile.uri;
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
