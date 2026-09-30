import { FitLevel, MindMonitorHsi, BandMap, ChannelMap, BandPowerFrame, BatteryReading, Vec3 } from '@/types/muse';
import { EEG_CHANNELS, BAND_NAMES } from '@/types/muse';

/**
 * Cabecera CSV compatible con Mind Monitor.
 * Verificar contra un CSV real exportado por Mind Monitor;
 * si difiere, solo se cambia esta constante.
 */
export const MM_CSV_HEADER = [
  'TimeStamp',
  'Delta_TP9', 'Delta_AF7', 'Delta_AF8', 'Delta_TP10',
  'Theta_TP9', 'Theta_AF7', 'Theta_AF8', 'Theta_TP10',
  'Alpha_TP9', 'Alpha_AF7', 'Alpha_AF8', 'Alpha_TP10',
  'Beta_TP9', 'Beta_AF7', 'Beta_AF8', 'Beta_TP10',
  'Gamma_TP9', 'Gamma_AF7', 'Gamma_AF8', 'Gamma_TP10',
  'RAW_TP9', 'RAW_AF7', 'RAW_AF8', 'RAW_TP10',
  'Accelerometer_X', 'Accelerometer_Y', 'Accelerometer_Z',
  'Gyro_X', 'Gyro_Y', 'Gyro_Z',
  'HeadBandOn',
  'HSI_TP9', 'HSI_AF7', 'HSI_AF8', 'HSI_TP10',
  'Battery', 'Elements',
].join(',');

/**
 * Mapeo de Fit Level a HSI de Mind Monitor: 0→1, 1→2, 2→4
 */
export const FIT_TO_HSI: Record<FitLevel, MindMonitorHsi> = {
  0: 1,
  1: 2,
  2: 4,
};

/**
 * Estado para formatear una fila CSV.
 */
export interface RowState {
  timestamp: Date;
  rawUv: ChannelMap<number | null>;
  bands: BandPowerFrame | null;
  accel: Vec3 | null;
  gyro: Vec3 | null;
  headbandOn: boolean;
  fit: ChannelMap<FitLevel>;
  battery: BatteryReading | null;
  marker: string | null;
}

/**
 * Formatea una fila CSV según el formato de Mind Monitor.
 * 
 * Reglas:
 * - TimeStamp: yyyy-MM-dd HH:mm:ss.SSS en hora local
 * - RAW_*: 3 decimales (µV)
 * - Bandas: 3 decimales (absoluteLog)
 * - Accel (g) y gyro (°/s): 3 decimales
 * - HeadBandOn: 1/0
 * - HSI_*: mapeo 0→1, 1→2, 2→4
 * - Battery: porcentaje con 1 decimal
 * - Elements: vacío salvo marcadores
 * - Celdas vacías = nada entre comas
 * - Fin de línea \n
 */
export function formatRow(state: RowState): string {
  const parts: string[] = [];

  // TimeStamp
  parts.push(formatTimestamp(state.timestamp));

  // Bandas (5 bandas × 4 canales = 20 columnas)
  for (const band of BAND_NAMES) {
    for (const ch of EEG_CHANNELS) {
      const value = state.bands?.absoluteLog[ch][band];
      parts.push(value !== undefined ? value.toFixed(3) : '');
    }
  }

  // RAW (4 canales)
  for (const ch of EEG_CHANNELS) {
    const value = state.rawUv[ch];
    parts.push(value !== null ? value.toFixed(3) : '');
  }

  // Accelerometer (3 ejes)
  parts.push(state.accel ? state.accel.x.toFixed(3) : '');
  parts.push(state.accel ? state.accel.y.toFixed(3) : '');
  parts.push(state.accel ? state.accel.z.toFixed(3) : '');

  // Gyro (3 ejes)
  parts.push(state.gyro ? state.gyro.x.toFixed(3) : '');
  parts.push(state.gyro ? state.gyro.y.toFixed(3) : '');
  parts.push(state.gyro ? state.gyro.z.toFixed(3) : '');

  // HeadBandOn
  parts.push(state.headbandOn ? '1' : '0');

  // HSI (4 canales)
  for (const ch of EEG_CHANNELS) {
    parts.push(String(FIT_TO_HSI[state.fit[ch]]));
  }

  // Battery
  parts.push(state.battery ? state.battery.percent.toFixed(1) : '');

  // Elements (marcador)
  parts.push(state.marker ?? '');

  return parts.join(',');
}

/**
 * Formatea timestamp como yyyy-MM-dd HH:mm:ss.SSS en hora local.
 */
function formatTimestamp(d: Date): string {
  const pad = (n: number, len: number = 2) => String(n).padStart(len, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/**
 * Genera nombre de archivo: mindMonitor_YYYY-MM-DD--HH-mm-ss.csv
 */
export function makeFileName(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `mindMonitor_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}--${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.csv`;
}
