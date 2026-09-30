import { EegPacket, EegChannel, TimedSample, BandPowerFrame, BandMap, ChannelMap, FitCheck } from '@/types/muse';
import { FFT_SIZE, SCOPE_HISTORY_SECONDS, SAMPLE_RATE_HZ, BANDS, BAND_UPDATE_HZ, FIT_UPDATE_HZ, MAINS_HZ } from '@/constants/muse';
import { RingBuffer } from './ringBuffer';
import { Fft, hannWindow } from './fft';
import { computeFit } from './fitCheck';
import { useMuseStore } from '@/store/useMuseStore';

const EEG_CHANNELS: EegChannel[] = ['TP9', 'AF7', 'AF8', 'TP10'];

/**
 * DspEngine — procesamiento de señales en tiempo real.
 * 
 * Buffers por canal:
 * - fftBuf: RingBuffer(256) — ventana de análisis (1 s)
 * - scopeBuf: RingBuffer(256 * SCOPE_HISTORY_SECONDS) — historial para osciloscopio
 * 
 * Las muestras de 256 Hz nunca pasan por React ni Zustand.
 * El engine publica bandas (10 Hz) y fit (2 Hz) directamente al store.
 */
class DspEngine {
  private fftBuf: Map<EegChannel, RingBuffer> = new Map();
  private scopeBuf: Map<EegChannel, RingBuffer> = new Map();
  private fft: Fft;
  private window: Float32Array;
  private sumW2: number;
  private bandTimer: ReturnType<typeof setInterval> | null = null;
  private fitTimer: ReturnType<typeof setInterval> | null = null;
  private rawSampleCallbacks: Set<(s: TimedSample) => void> = new Set();
  private bandCallbacks: Set<(f: BandPowerFrame) => void> = new Set();
  private lastFit: { fit: FitCheck; headbandOn: boolean } | null = null;
  private pendingCounters: ChannelMap<number> = { TP9: 0, AF7: 0, AF8: 0, TP10: 0 };
  private highPassState: Map<EegChannel, { yPrev: number; xPrev: number }> = new Map();
  private packetsReceived: ChannelMap<number> = { TP9: 0, AF7: 0, AF8: 0, TP10: 0 };
  private packetsDropped: ChannelMap<number> = { TP9: 0, AF7: 0, AF8: 0, TP10: 0 };
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private sequenceUnwrappers: Map<EegChannel, { lastSeq: number | null; wraps: number; lastAbsPacket: number | null }> = new Map();

  constructor() {
    this.fft = new Fft(FFT_SIZE);
    this.window = hannWindow(FFT_SIZE);
    this.sumW2 = this.window.reduce((sum, w) => sum + w * w, 0);

    for (const ch of EEG_CHANNELS) {
      this.fftBuf.set(ch, new RingBuffer(FFT_SIZE));
      this.scopeBuf.set(ch, new RingBuffer(SAMPLE_RATE_HZ * SCOPE_HISTORY_SECONDS));
      this.highPassState.set(ch, { yPrev: 0, xPrev: 0 });
      this.sequenceUnwrappers.set(ch, { lastSeq: null, wraps: 0, lastAbsPacket: null });
    }
  }

  pushEeg(packet: EegPacket): void {
    const { channel, sequence, samplesUv } = packet;
    const fftBuffer = this.fftBuf.get(channel);
    const scopeBuffer = this.scopeBuf.get(channel);
    if (!fftBuffer || !scopeBuffer) return;

    // Track sequence for stats
    this.trackSequence(channel, sequence);

    // Empujar a ambos buffers
    fftBuffer.pushMany(samplesUv);
    scopeBuffer.pushMany(samplesUv);

    // Notificar a callbacks de raw samples (para recorder)
    const now = Date.now();
    for (let i = 0; i < samplesUv.length; i++) {
      const sample: TimedSample = {
        channel,
        tMs: now,
        uv: samplesUv[i],
      };
      for (const cb of this.rawSampleCallbacks) {
        cb(sample);
      }
    }
  }

  private trackSequence(channel: EegChannel, sequence: number): void {
    const unwrapper = this.sequenceUnwrappers.get(channel);
    if (!unwrapper) return;

    if (unwrapper.lastSeq === null) {
      unwrapper.lastSeq = sequence;
      unwrapper.lastAbsPacket = 0;
      this.packetsReceived[channel]++;
      return;
    }

    // Detectar wrap
    if (sequence < unwrapper.lastSeq - 32768) {
      unwrapper.wraps++;
    }

    const absPacket = unwrapper.wraps * 65536 + sequence;
    const gap = unwrapper.lastAbsPacket !== null ? absPacket - unwrapper.lastAbsPacket - 1 : 0;

    if (gap > 0 && gap < 50) {
      // Paquetes perdidos
      this.packetsDropped[channel] += gap;
    }

    unwrapper.lastSeq = sequence;
    unwrapper.lastAbsPacket = absPacket;
    this.packetsReceived[channel]++;
  }

  start(): void {
    // Timer de bandas a 10 Hz
    this.bandTimer = setInterval(() => {
      this.computeBands();
    }, 1000 / BAND_UPDATE_HZ);

    // Timer de fit a 2 Hz
    this.fitTimer = setInterval(() => {
      this.computeFitCheck();
    }, 1000 / FIT_UPDATE_HZ);

    // Timer de stats a 1 Hz
    this.statsTimer = setInterval(() => {
      this.updateStats();
    }, 1000);
  }

  stop(): void {
    if (this.bandTimer) {
      clearInterval(this.bandTimer);
      this.bandTimer = null;
    }
    if (this.fitTimer) {
      clearInterval(this.fitTimer);
      this.fitTimer = null;
    }
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  private updateStats(): void {
    const store = useMuseStore.getState();
    const totalReceived = Object.values(this.packetsReceived).reduce((a, b) => a + b, 0);
    const totalExpected = 4 * 256; // 4 canales * 256 Hz
    const effectiveRateHz = totalReceived > 0 ? (totalReceived / totalExpected) * 256 : null;

    store.setStats({
      packetsReceived: { ...this.packetsReceived },
      packetsDropped: { ...this.packetsDropped },
      effectiveRateHz,
    });
  }

  getScopeWindow(ch: EegChannel, seconds: number, out: Float32Array): number {
    const buffer = this.scopeBuf.get(ch);
    if (!buffer) return 0;
    const n = Math.min(seconds * SAMPLE_RATE_HZ, out.length);
    return buffer.copyLast(n, out);
  }

  onRawSample(cb: (s: TimedSample) => void): () => void {
    this.rawSampleCallbacks.add(cb);
    return () => this.rawSampleCallbacks.delete(cb);
  }

  onBands(cb: (f: BandPowerFrame) => void): () => void {
    this.bandCallbacks.add(cb);
    return () => this.bandCallbacks.delete(cb);
  }

  private computeBands(): void {
    const tMs = Date.now();
    const absoluteLog: ChannelMap<BandMap<number>> = {} as ChannelMap<BandMap<number>>;
    const relative: ChannelMap<BandMap<number>> = {} as ChannelMap<BandMap<number>>;

    for (const ch of EEG_CHANNELS) {
      const buffer = this.fftBuf.get(ch);
      if (!buffer || buffer.count < FFT_SIZE) {
        absoluteLog[ch] = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
        relative[ch] = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
        continue;
      }

      // Copiar ventana y quitar media
      const x = new Float32Array(FFT_SIZE);
      buffer.copyTo(x);
      const mean = x.reduce((sum, v) => sum + v, 0) / FFT_SIZE;
      for (let i = 0; i < FFT_SIZE; i++) x[i] -= mean;

      // Aplicar ventana Hann
      for (let i = 0; i < FFT_SIZE; i++) x[i] *= this.window[i];

      // FFT
      const im = new Float32Array(FFT_SIZE);
      this.fft.forward(x, im);

      // Calcular PSD unilateral
      const psd = new Float32Array(FFT_SIZE / 2 + 1);
      for (let k = 0; k <= FFT_SIZE / 2; k++) {
        const power = x[k] * x[k] + im[k] * im[k];
        psd[k] = power / (FFT_SIZE * this.sumW2);
        if (k > 0 && k < FFT_SIZE / 2) {
          psd[k] *= 2; // Duplicar para bins no-DC ni-Nyquist
        }
      }

      // Calcular potencia por banda
      const df = SAMPLE_RATE_HZ / FFT_SIZE; // Resolución de frecuencia
      const absolute: BandMap<number> = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };

      for (const band of BANDS) {
        const kLow = Math.ceil(band.lowHz / df);
        const kHigh = band.name === 'gamma'
          ? Math.floor(band.highHz / df)
          : Math.ceil(band.highHz / df) - 1;

        let sum = 0;
        for (let k = kLow; k <= kHigh && k <= FFT_SIZE / 2; k++) {
          sum += psd[k] * df;
        }
        absolute[band.name] = sum;
      }

      // Calcular log10 y relative
      const total = Object.values(absolute).reduce((sum, v) => sum + v, 0);
      const absLog: BandMap<number> = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
      const rel: BandMap<number> = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };

      for (const band of BANDS) {
        absLog[band.name] = Math.log10(Math.max(absolute[band.name], 1e-12));
        rel[band.name] = total > 0 ? absolute[band.name] / total : 0;
      }

      absoluteLog[ch] = absLog;
      relative[ch] = rel;
    }

    const frame: BandPowerFrame = { tMs, absoluteLog, relative };

    // Publicar al store
    useMuseStore.getState().setBands(frame);

    // Notificar a callbacks
    for (const cb of this.bandCallbacks) {
      cb(frame);
    }
  }

  private computeFitCheck(): void {
    const windows: ChannelMap<Float32Array> = {} as ChannelMap<Float32Array>;

    for (const ch of EEG_CHANNELS) {
      const buffer = this.fftBuf.get(ch);
      if (!buffer || buffer.count < FFT_SIZE) {
        windows[ch] = new Float32Array(0);
        continue;
      }
      const w = new Float32Array(FFT_SIZE);
      buffer.copyTo(w);
      windows[ch] = w;
    }

    const previous: FitCheck = this.lastFit?.fit ?? { TP9: 2, AF7: 2, AF8: 2, TP10: 2 };
    const result = computeFit(windows, previous, this.pendingCounters);
    this.lastFit = result;

    // Publicar al store
    useMuseStore.getState().setFit(result.fit);
    useMuseStore.setState({ headbandOn: result.headbandOn });
  }

  getLastFit(): { fit: FitCheck; headbandOn: boolean } | null {
    return this.lastFit;
  }
}

export const dspEngine = new DspEngine();
