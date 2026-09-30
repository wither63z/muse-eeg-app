import { File, Directory, Paths } from 'expo-file-system';
import { RecordingMeta, TimedSample, BandPowerFrame, ChannelMap, FitLevel, Vec3 } from '@/types/muse';
import { EEG_CHANNELS } from '@/types/muse';
import { MM_CSV_HEADER, formatRow, makeFileName, RowState } from './csvFormat';
import { dspEngine } from '@/dsp/dspEngine';
import { useMuseStore } from '@/store/useMuseStore';

const MAX_RECORDING_MIN = 20;
const FLUSH_INTERVAL_MS = 60000; // 60 s
const ROW_COUNT_INTERVAL_MS = 1000; // 1 s

/**
 * Interfaz para escritura de grabaciones.
 * Permite reemplazar la implementación si expo-file-system cambia.
 */
export interface RecordingSink {
  write(rows: string[]): Promise<void>;
  close(): Promise<string>;
}

/**
 * Implementación segmentada: escribe archivos part-NNNN.csv cada 60 s.
 * expo-file-system de SDK 51+ no permite append, de ahí los segmentos.
 */
class SegmentedSink implements RecordingSink {
  private dir: Directory;
  private partNumber: number = 0;
  private currentRows: string[] = [];
  private totalRows: number = 0;

  constructor(dir: Directory) {
    this.dir = dir;
  }

  async write(rows: string[]): Promise<void> {
    this.currentRows.push(...rows);
    this.totalRows += rows.length;

    // Si ha pasado el intervalo de flush, escribir archivo
    if (this.currentRows.length >= 15360) { // ~60 s a 256 Hz
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.currentRows.length === 0) return;

    this.partNumber++;
    const partFile = new File(this.dir, `part-${String(this.partNumber).padStart(4, '0')}.csv`);
    partFile.create({ overwrite: true });
    partFile.write(this.currentRows.join('\n') + '\n');

    this.currentRows = [];
  }

  async close(): Promise<string> {
    await this.flush();

    // Escribir meta.json
    const meta: RecordingMeta = {
      id: this.dir.name || '',
      fileName: makeFileName(new Date()),
      startedAtMs: Date.now(),
      durationMs: 0,
      rowCount: this.totalRows,
      sizeBytes: 0,
      uri: this.dir.uri,
    };

    const metaFile = new File(this.dir, 'meta.json');
    metaFile.create({ overwrite: true });
    metaFile.write(JSON.stringify(meta));

    return this.dir.uri;
  }
}

/**
 * Recorder — grabación de sesiones EEG en formato CSV.
 * 
 * Las filas se acumulan en memoria y se vacían a archivos segmentados
 * cada 60 s (~15,360 filas). Límite duro de 20 minutos.
 */
class Recorder {
  private sink: RecordingSink | null = null;
  private recording: boolean = false;
  private startTime: number = 0;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private rowCountTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeRaw: (() => void) | null = null;
  private unsubscribeBands: (() => void) | null = null;
  private lastBands: BandPowerFrame | null = null;
  private lastRaw: ChannelMap<number | null> = { TP9: null, AF7: null, AF8: null, TP10: null };
  private lastAccel: Vec3 | null = null;
  private lastGyro: Vec3 | null = null;
  private lastFit: ChannelMap<FitLevel> = { TP9: 2, AF7: 2, AF8: 2, TP10: 2 };
  private lastBattery: number | null = null;
  private marker: string | null = null;
  private pendingRows: string[] = [];

  async start(): Promise<void> {
    const store = useMuseStore.getState();
    if (store.status !== 'streaming') {
      throw new Error('No se puede grabar: no hay conexión activa');
    }

    const id = Date.now().toString(36);
    const dir = new Directory(Paths.document, 'recordings', id);
    dir.create({ intermediates: true });

    this.sink = new SegmentedSink(dir);
    this.recording = true;
    this.startTime = Date.now();
    this.pendingRows = [];

    // Escribir cabecera
    await this.sink.write([MM_CSV_HEADER]);

    // Suscribirse a muestras crudas
    this.unsubscribeRaw = dspEngine.onRawSample((sample) => {
      this.lastRaw[sample.channel] = sample.uv;
      this.addRow(sample.tMs);
    });

    // Suscribirse a bandas
    this.unsubscribeBands = dspEngine.onBands((frame) => {
      this.lastBands = frame;
    });

    // Timer de flush cada 60 s
    this.flushTimer = setInterval(async () => {
      if (this.sink && this.pendingRows.length > 0) {
        await this.sink.write(this.pendingRows);
        this.pendingRows = [];
      }
    }, FLUSH_INTERVAL_MS);

    // Timer de row count cada 1 s
    this.rowCountTimer = setInterval(() => {
      store.setRecordingRowCount(this.getRowCount());
    }, ROW_COUNT_INTERVAL_MS);

    store.setRecording(true, this.startTime);
  }

  async stop(): Promise<RecordingMeta> {
    if (!this.recording || !this.sink) {
      throw new Error('No hay grabación activa');
    }

    this.recording = false;

    // Limpiar timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.rowCountTimer) {
      clearInterval(this.rowCountTimer);
      this.rowCountTimer = null;
    }

    // Desuscribirse
    if (this.unsubscribeRaw) {
      this.unsubscribeRaw();
      this.unsubscribeRaw = null;
    }
    if (this.unsubscribeBands) {
      this.unsubscribeBands();
      this.unsubscribeBands = null;
    }

    // Flush final
    if (this.pendingRows.length > 0) {
      await this.sink.write(this.pendingRows);
      this.pendingRows = [];
    }

    const uri = await this.sink.close();
    this.sink = null;

    const store = useMuseStore.getState();
    store.setRecording(false, null);

    const meta: RecordingMeta = {
      id: uri.split('/').pop() || '',
      fileName: makeFileName(new Date(this.startTime)),
      startedAtMs: this.startTime,
      durationMs: Date.now() - this.startTime,
      rowCount: this.getRowCount(),
      sizeBytes: 0,
      uri,
    };

    return meta;
  }

  addMarker(label?: string): void {
    this.marker = label || `/Marker/${Date.now()}`;
  }

  private addRow(tMs: number): void {
    if (!this.recording) return;

    const store = useMuseStore.getState();
    const rowState: RowState = {
      timestamp: new Date(tMs),
      rawUv: { ...this.lastRaw },
      bands: this.lastBands,
      accel: this.lastAccel,
      gyro: this.lastGyro,
      headbandOn: store.headbandOn,
      fit: { ...this.lastFit },
      battery: store.telemetry.battery,
      marker: this.marker,
    };

    const row = formatRow(rowState);
    this.pendingRows.push(row);
    this.marker = null;

    // Verificar límite de tiempo
    const elapsed = Date.now() - this.startTime;
    if (elapsed >= MAX_RECORDING_MIN * 60 * 1000) {
      this.stop();
    }
  }

  private getRowCount(): number {
    return this.pendingRows.length;
  }
}

export const recorder = new Recorder();
