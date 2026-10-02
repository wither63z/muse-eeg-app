const base = (id: string) => `273e${id}-4c4d-454d-96be-f03bac821358`;

export const MUSE_SERVICE_UUID = '0000fe8d-0000-1000-8000-00805f9b34fb';
export const MUSE_CHAR = {
  CONTROL: base('0001'),
  GYRO:    base('0009'),
  ACCEL:   base('000a'),
  BATTERY: base('000b'),   // telemetría
  PPG:     base('000c'),
  TP9:     base('0003'),
  AF7:     base('0004'),
  AF8:     base('0005'),
  TP10:    base('0006'),
} as const;

export const EEG_CHAR_BY_CHANNEL: Record<'TP9'|'AF7'|'AF8'|'TP10', string> = {
  TP9: MUSE_CHAR.TP9, AF7: MUSE_CHAR.AF7, AF8: MUSE_CHAR.AF8, TP10: MUSE_CHAR.TP10,
};

export const SAMPLE_RATE_HZ = 256;
export const SAMPLES_PER_EEG_PACKET = 12;
export const EEG_UV_PER_LSB = 0.48828125;    // 2000 µV / 4096
export const EEG_ADC_MIDPOINT = 2048;
export const ACCEL_G_PER_LSB = 0.0000610352;
export const GYRO_DPS_PER_LSB = 0.0074768;
export const BATTERY_PERCENT_DIVISOR = 512;  // raw / 512 = %
export const BATTERY_MV_PER_LSB = 2.2;

export const MUSE_NAME_PREFIX = 'Muse';
export const MUSE_PRESET = 'p21';            // EEG 4ch + telemetría + IMU (configurable)

export const BANDS = [
  { name: 'delta', lowHz: 0.5, highHz: 4 },
  { name: 'theta', lowHz: 4,   highHz: 8 },
  { name: 'alpha', lowHz: 8,   highHz: 13 },
  { name: 'beta',  lowHz: 13,  highHz: 30 },
  { name: 'gamma', lowHz: 30,  highHz: 45 },   // inclusivo
] as const;

export const FFT_SIZE = 256;
export const SCOPE_HISTORY_SECONDS = 10;
export const BAND_UPDATE_HZ = 10;
export const FIT_UPDATE_HZ = 2;
export const MAINS_HZ = 60;   // Ecuador usa 60 Hz
