import { create } from 'zustand';
import { subscribeWithSelector, persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import { MuseStore, ConnectionStatus, MuseDeviceInfo, BatteryReading, Vec3, FitCheck, BandPowerFrame, StreamStats, RecordingMeta } from '@/types/muse';

/**
 * Store de Zustand — solo estado lento (≤10 Hz).
 *
 * Prohibido almacenar muestras crudas o buffers aquí.
 * Las muestras de 256 Hz viven en dspEngine (Float32Array).
 *
 * Los componentes usan selectores finos y useShallow para objetos.
 * Nunca useMuseStore() sin selector.
 */

/**
 * Estado inicial de la tienda Muse.
 *
 * Regla crítica: las muestras de 256 Hz NUNCA entran aquí.
 * Solo estado lento ≤10 Hz: bands (10 Hz), fit (2 Hz), battery (~0.1 Hz),
 * accel/gyro (throttled a 10 Hz), stats (1 Hz).
 *
 * Los componentes usan selectores finos (`useMuseStore(s => s.status)`)
 * y `useShallow` para objetos. Nunca `useMuseStore()` sin selector.
 */
const INITIAL_STATE = {
  status: 'idle' as ConnectionStatus,
  errorMessage: null,
  discovered: [] as MuseDeviceInfo[],
  device: null,
  telemetry: {
    battery: null,
    accel: null,
    gyro: null,
    ppg: null,
  },
  fit: { TP9: 2, AF7: 2, AF8: 2, TP10: 2 } as FitCheck,
  headbandOn: false,
  bands: null,
  heartRate: null,
  stats: {
    packetsReceived: { TP9: 0, AF7: 0, AF8: 0, TP10: 0 },
    packetsDropped: { TP9: 0, AF7: 0, AF8: 0, TP10: 0 },
    effectiveRateHz: null,
  } as StreamStats,
  isRecording: false,
  isSimulating: false,
  recordingStartedAtMs: null,
  recordingRowCount: 0,
  recordings: [] as RecordingMeta[],
};

export const useMuseStore = create<MuseStore>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        ...INITIAL_STATE,

        // Acciones
        setStatus: (status: ConnectionStatus, errorMessage?: string | null) =>
          set({ status, errorMessage: errorMessage ?? null }),

        setDiscovered: (devices: MuseDeviceInfo[]) =>
          set({ discovered: devices }),

        setDevice: (device: MuseDeviceInfo | null) =>
          set({ device }),

        setBattery: (b: BatteryReading) =>
          set((state) => ({
            telemetry: { ...state.telemetry, battery: b },
          })),

        setMotion: (accel: Vec3 | null, gyro: Vec3 | null, tMs: number) =>
          set((state) => ({
            telemetry: {
              ...state.telemetry,
              accel: accel ? { ...accel, tMs } : state.telemetry.accel,
              gyro: gyro ? { ...gyro, tMs } : state.telemetry.gyro,
            },
          })),

        setFit: (fit: FitCheck) =>
          set({ fit }),

        setBands: (frame: BandPowerFrame) =>
          set({ bands: frame }),

        setHeartRate: (bpm: number | null) =>
          set({ heartRate: bpm }),

        setStats: (stats: StreamStats) =>
          set({ stats }),

        setRecording: (active: boolean, startedAtMs: number | null) =>
          set({ isRecording: active, recordingStartedAtMs: startedAtMs }),

        setSimulating: (active: boolean) =>
          set({ isSimulating: active }),

        setRecordingRowCount: (n: number) =>
          set({ recordingRowCount: n }),

        setRecordings: (list: RecordingMeta[]) =>
          set({ recordings: list }),

        reset: () => set((state) => ({ ...INITIAL_STATE, recordings: state.recordings })),
      }),
      {
        name: 'muse-storage',
        storage:
          Platform.OS === 'web' ? createJSONStorage(() => localStorage) : undefined,
        partialize: (state) => ({
          status: state.status, // Guardar solo estado ligero
        }),
      }
    )
  )
);
