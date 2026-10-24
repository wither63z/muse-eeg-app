import { Platform } from 'react-native';
import type { RecordingMeta, SensorSample, TimedSample } from '@/types/muse';
import { RAW_CSV_HEADER, formatRawSample } from './csvFormat';
import { dspEngine } from '@/dsp/dspEngine';
import { useMuseStore } from '@/store/useMuseStore';

export interface RecordingSink {
  write(rows: string[]): Promise<void>;
  close(meta: RecordingMeta): Promise<string>;
  getTotalRows(): number;
  readonly dir: string;
}
class SegmentedSink implements RecordingSink {
  readonly dir: string;
  private part = 0;
  private total = 0;
  constructor(dir: string) {
    this.dir = dir;
  }
  getTotalRows() {
    return this.total;
  }
  async write(rows: string[]) {
    const fs = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
    const name = `${this.dir}/part-${String(this.part + 1).padStart(6, '0')}.csv`;
    await fs.writeAsStringAsync(
      name,
      (this.part === 0 ? RAW_CSV_HEADER + '\n' : '') + rows.join('\n') + '\n',
    );
    this.part++;
    this.total += rows.length;
  }
  async close(meta: RecordingMeta) {
    if (!this.part) await this.write([]);
    const fs = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
    await fs.writeAsStringAsync(`${this.dir}/meta.json`, JSON.stringify(meta));
    return this.dir;
  }
}
class WebSink implements RecordingSink {
  readonly dir: string;
  private rows: string[] = [];
  constructor(id: string) {
    this.dir = id;
  }
  getTotalRows() {
    return this.rows.length;
  }
  async write(rows: string[]) {
    this.rows.push(...rows);
  }
  async close(meta: RecordingMeta) {
    const repo = require('./recordingsRepo.web') as typeof import('./recordingsRepo.web');
    await repo.saveWebSession(meta.id, meta, this.rows);
    return this.dir;
  }
}

/** Bounded sessions; failed writes retain their rows so stop can be retried. */
class Recorder {
  private sink: RecordingSink | null = null;
  private starting = false;
  private stopping: Promise<RecordingMeta> | null = null;
  private stoppedAt: number | null = null;
  private recording = false;
  private startTime = 0;
  private marker: string | null = null;
  private source: 'muse' | 'simulation' = 'muse';
  private pending: string[] = [];
  private flushing: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unsubscribe: (() => void)[] = [];

  async start(injectedSink?: RecordingSink): Promise<void> {
    if (this.sink || this.starting) throw new Error('Primero guarda la grabación anterior.');
    const store = useMuseStore.getState();
    if (store.status !== 'streaming')
      throw new Error('Conecta Muse o el simulador antes de grabar.');
    this.starting = true;
    try {
      this.startTime = Date.now();
      this.stoppedAt = null;
      this.source = store.isSimulating ? 'simulation' : 'muse';
      const id = `muse-${this.startTime.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      if (injectedSink) this.sink = injectedSink;
      else if (Platform.OS === 'web') this.sink = new WebSink(id);
      else {
        const fs = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
        const dir = `${fs.documentDirectory}recordings/${id}`;
        await fs.makeDirectoryAsync(dir, { intermediates: true });
        this.sink = new SegmentedSink(dir);
      }
      this.pending = [];
      this.marker = null;
      this.recording = true;
      const append = (sample: TimedSample | SensorSample) => {
        if (!this.recording) return;
        this.pending.push(
          formatRawSample(
            { ...sample, source: sample.source || this.source },
            this.marker,
            this.sink?.dir.split('/').pop(),
          ),
        );
        this.marker = null;
      };
      this.unsubscribe = [dspEngine.onRawSample(append)];
      if (dspEngine.onSensorSample) this.unsubscribe.push(dspEngine.onSensorSample(append));
      store.setRecording(true, this.startTime);
      this.timer = setInterval(() => {
        store.setRecordingRowCount((this.sink?.getTotalRows() || 0) + this.pending.length);
        if (Date.now() - this.startTime >= 20 * 60 * 1000)
          void this.stop().catch(() =>
            store.setStatus(
              'error',
              'No se pudo guardar. Libera espacio y vuelve a detener la grabación.',
            ),
          );
        else
          void this.flush().catch(() =>
            store.setStatus(
              'error',
              'No se pudo escribir. No cierres la aplicación; revisa el espacio disponible.',
            ),
          );
      }, 1000);
    } finally {
      this.starting = false;
    }
  }
  private flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (!this.sink || !this.pending.length) return Promise.resolve();
    const rows = this.pending.splice(0);
    this.flushing = this.sink
      .write(rows)
      .catch((error) => {
        this.pending.unshift(...rows);
        throw error;
      })
      .finally(() => {
        this.flushing = null;
      });
    return this.flushing;
  }
  stop(): Promise<RecordingMeta> {
    if (this.stopping) return this.stopping;
    this.stopping = this.finish().finally(() => {
      this.stopping = null;
    });
    return this.stopping;
  }
  private async finish(): Promise<RecordingMeta> {
    if (!this.sink) throw new Error('No hay grabación activa.');
    this.recording = false;
    this.stoppedAt ??= Date.now();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.unsubscribe.splice(0).forEach((remove) => remove());
    if (this.flushing) {
      try {
        await this.flushing;
      } catch {
        /* Retry the preserved rows below. */
      }
    }
    await this.flush();
    const id = this.sink.dir.split('/').pop()!;
    const meta: RecordingMeta = {
      id,
      fileName: `${id}.csv`,
      startedAtMs: this.startTime,
      durationMs: this.stoppedAt - this.startTime,
      rowCount: this.sink.getTotalRows(),
      sizeBytes: 0,
      uri: this.sink.dir,
      format: 'raw-v2',
      source: this.source,
    };
    await this.sink.close(meta);
    this.sink = null;
    useMuseStore.getState().setRecording(false, null);
    return meta;
  }
  addMarker(label?: string): void {
    if (this.recording) this.marker = label || `M-${Date.now()}`;
  }
}
export const recorder = new Recorder();
