// ───────────── EEG ─────────────
export const EEG_CHANNELS = ['TP9', 'AF7', 'AF8', 'TP10'] as const;
export type EegChannel = (typeof EEG_CHANNELS)[number];
export type ChannelMap<T> = Record<EegChannel, T>;

/** Paquete EEG decodificado de UNA característica GATT (12 muestras). */
export interface EegPacket {
  channel: EegChannel;
  /** Índice de secuencia uint16 (0..65535, con wrap). */
  sequence: number;
  /** 12 muestras en microvoltios. */
  samplesUv: Float32Array;
  /** Date.now() al recibir la notificación BLE. */
  receivedAtMs: number;
}

/** Muestra con timestamp absoluto, tras desenvolver secuencia. */
export interface TimedSample {
  channel: EegChannel;
  tMs: number;
  uv: number;
}

// ───────────── Fit Check ─────────────
export const FIT = { GOOD: 0, FAIR: 1, POOR: 2 } as const;
export type FitLevel = (typeof FIT)[keyof typeof FIT];
export type FitCheck = ChannelMap<FitLevel>;
/** Valores HSI del CSV de Mind Monitor: 1 bueno, 2 regular, 4 malo. */
export type MindMonitorHsi = 1 | 2 | 4;

// ───────────── Bandas ─────────────
export const BAND_NAMES = ['delta', 'theta', 'alpha', 'beta', 'gamma'] as const;
export type BandName = (typeof BAND_NAMES)[number];
export type BandMap<T> = Record<BandName, T>;

export interface BandDef {
  name: BandName;
  lowHz: number;   // inclusivo
  highHz: number;  // exclusivo, salvo gamma (inclusivo)
}

export interface BandPowerFrame {
  tMs: number;
  /** log10 de potencia absoluta (uV²), análogo al "Bels" de Mind Monitor. */
  absoluteLog: ChannelMap<BandMap<number>>;
  /** Potencia relativa 0..1 respecto al total 0.5–45 Hz. */
  relative: ChannelMap<BandMap<number>>;
}

// ───────────── Telemetría ─────────────
export interface BatteryReading {
  sequence: number;
  percent: number;     // 0..100
  voltageMv: number;
  receivedAtMs: number;
}

export interface Vec3 { x: number; y: number; z: number }

export interface MotionSample {
  sequence: number;
  /** 3 muestras por paquete (≈52 Hz). */
  samples: [Vec3, Vec3, Vec3];
  receivedAtMs: number;
}
export type AccelerometerPacket = MotionSample; // unidades: g
export type GyroscopePacket = MotionSample;     // unidades: °/s

export interface PpgSample {
  sequence: number;
  /** Muse clásico: 6 muestras unsigned de 24 bits por paquete. */
  samples: number[];
  receivedAtMs: number;
}

export interface Telemetry {
  battery: BatteryReading | null;
  accel: (Vec3 & { tMs: number }) | null;  // última muestra
  gyro: (Vec3 & { tMs: number }) | null;
  ppg: PpgSample | null;
}

// ───────────── Conexión ─────────────
export type ConnectionStatus =
  | 'idle' | 'requesting-permissions' | 'scanning' | 'connecting'
  | 'discovering' | 'streaming' | 'disconnecting' | 'error';

export interface MuseDeviceInfo {
  id: string;        // deviceId de ble-plx (MAC en Android, UUID en iOS)
  name: string;      // "Muse-XXXX"
  rssi: number | null;
}

export interface StreamStats {
  packetsReceived: ChannelMap<number>;
  packetsDropped: ChannelMap<number>;
  effectiveRateHz: number | null;
}

// ───────────── Grabaciones ─────────────
export interface RecordingMeta {
  id: string;
  fileName: string;         // mindMonitor_YYYY-MM-DD--HH-mm-ss.csv
  startedAtMs: number;
  durationMs: number;
  rowCount: number;
  sizeBytes: number;
  uri: string;
}

// ───────────── Store ─────────────
export interface MuseState {
  status: ConnectionStatus;
  errorMessage: string | null;
  discovered: MuseDeviceInfo[];
  device: MuseDeviceInfo | null;
  telemetry: Telemetry;
  fit: FitCheck;
  headbandOn: boolean;
  bands: BandPowerFrame | null;      // actualizado a 10 Hz
  heartRate: number | null;          // BPM estimado desde PPG
  stats: StreamStats;
  isRecording: boolean;
  isSimulating: boolean;
  recordingStartedAtMs: number | null;
  recordingRowCount: number;
  recordings: RecordingMeta[];
}

export interface MuseActions {
  setStatus(status: ConnectionStatus, errorMessage?: string | null): void;
  setDiscovered(devices: MuseDeviceInfo[]): void;
  setDevice(device: MuseDeviceInfo | null): void;
  setBattery(b: BatteryReading): void;
  setMotion(accel: Vec3 | null, gyro: Vec3 | null, tMs: number): void;
  setFit(fit: FitCheck): void;
  setBands(frame: BandPowerFrame): void;
  setHeartRate(bpm: number | null): void;
  setStats(stats: StreamStats): void;
  setRecording(active: boolean, startedAtMs: number | null): void;
  setSimulating(active: boolean): void;
  setRecordingRowCount(n: number): void;
  setRecordings(list: RecordingMeta[]): void;
  reset(): void;   // tras desconexión: limpia telemetría/fit/bands/stats
}

export type MuseStore = MuseState & MuseActions;
