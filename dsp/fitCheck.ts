import { ChannelMap, FitCheck, FitLevel } from '@/types/muse';
import { MAINS_HZ } from '@/constants/muse';

/**
 * Umbrales empíricos para Fit Check. Ajustables con datos reales.
 */
export const FIT_THRESHOLDS = {
  saturationUv: 990,        // max(abs(uv)) >= esto → Malo
  flatSigmaUv: 1,         // σ < esto → Malo (señal plana)
  poorSigmaUv: 100,        // σ > esto → Malo
  fairSigmaUv: 40,         // σ >= esto → Regular
  goodSigmaUv: 1,          // σ >= esto → Bueno
  poorMainsRatio: 0.5,     // ratioMains > esto → Malo
  fairMainsRatio: 0.2,     // ratioMains >= esto → Regular
  hysteresisCount: 2,       // evaluaciones consecutivas para cambiar de nivel
} as const;

/**
 * Calcula el nivel de ajuste (fit) por canal.
 * 
 * Criterios:
 * - 2 Malo: saturación, señal plana, σ > 100 µV, o ratioMains > 0.5
 * - 1 Regular: σ ∈ [40, 100] µV o ratioMains ∈ [0.2, 0.5]
 * - 0 Bueno: σ ∈ [1, 40] µV y ratioMains < 0.2
 * 
 * Histéresis: un canal cambia de nivel solo si el nuevo nivel se repite
 * en 2 evaluaciones consecutivas.
 */
export function computeFit(
  windows: ChannelMap<Float32Array>,
  previous: FitCheck,
  pendingCounters: ChannelMap<number>,
): { fit: FitCheck; headbandOn: boolean; diagnostics: ChannelMap<SignalQualityDiagnostic> } {
  const channels: (keyof ChannelMap<FitLevel>)[] = ['TP9', 'AF7', 'AF8', 'TP10'];
  const newFit: FitCheck = { ...previous };
  let allPoor = true;
  const diagnostics = {} as ChannelMap<SignalQualityDiagnostic>;

  for (const ch of channels) {
    const window = windows[ch];
    diagnostics[ch] = inspectSignalQuality(window);
    const level = diagnostics[ch].level;

    // Histéresis
    if (level !== previous[ch]) {
      pendingCounters[ch]++;
      if (pendingCounters[ch] >= FIT_THRESHOLDS.hysteresisCount) {
        newFit[ch] = level;
        pendingCounters[ch] = 0;
      }
    } else {
      pendingCounters[ch] = 0;
    }

    if (newFit[ch] !== 2) {
      allPoor = false;
    }
  }

  return { fit: newFit, headbandOn: !allPoor, diagnostics };
}

export interface SignalQualityDiagnostic {
  level: FitLevel;
  sigmaUv: number;
  mainsRatio: number;
  clippedFraction: number;
  reason: string;
}

export function inspectSignalQuality(window: Float32Array): SignalQualityDiagnostic {
  const n = window.length;
  const result: SignalQualityDiagnostic = { level: 2, sigmaUv: 0, mainsRatio: 0, clippedFraction: 0, reason: 'Esperando datos' };
  if (n === 0) return result;
  let sum = 0, clipped = 0;
  for (const value of window) {
    if (!Number.isFinite(value)) return { ...result, reason: 'Datos inválidos' };
    sum += value;
    if (Math.abs(value) >= FIT_THRESHOLDS.saturationUv) clipped++;
  }
  const mean = sum / n;
  let sumSq = 0;
  for (const value of window) sumSq += (value - mean) ** 2;
  result.sigmaUv = Math.sqrt(sumSq / n);
  result.clippedFraction = clipped / n;
  // A single transient must not classify an entire window as saturated.
  if (result.clippedFraction >= 0.02) return { ...result, reason: 'Señal saturada' };
  if (result.sigmaUv < FIT_THRESHOLDS.flatSigmaUv) return { ...result, reason: 'Señal plana' };
  if (result.sigmaUv > FIT_THRESHOLDS.poorSigmaUv) return { ...result, reason: 'Variación excesiva' };
  result.mainsRatio = calculateMainsRatio(window, mean);
  if (result.mainsRatio > FIT_THRESHOLDS.poorMainsRatio) return { ...result, reason: 'Interferencia de red' };
  if (result.sigmaUv >= FIT_THRESHOLDS.fairSigmaUv || result.mainsRatio >= FIT_THRESHOLDS.fairMainsRatio) {
    return { ...result, level: 1, reason: 'Señal regular' };
  }
  return { ...result, level: 0, reason: 'Señal buena' };
}

/**
 * Calcula la relación de potencia en la frecuencia de red (MAINS_HZ ± 2 Hz)
 * respecto a la potencia total en 1–45 Hz más la potencia de red.
 */
function calculateMainsRatio(window: Float32Array, mean: number): number {
  const n = window.length;
  if (n < 2) return 0;

  // FFT simple para calcular ratioMains
  // Usamos la misma ventana que computeBands
  const re = new Float32Array(n);
  const im = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    re[i] = window[i] - mean;
  }

  // FFT radix-2 simple
  fftForward(re, im, n);

  // Calcular potencia en bandas de frecuencia
  const df = 256 / n; // Resolución de frecuencia
  let mainsPower = 0;
  let totalPower = 0;

  for (let k = 0; k <= n / 2; k++) {
    const freq = k * df;
    const power = re[k] * re[k] + im[k] * im[k];

    if (freq >= 1 && freq <= 45) {
      totalPower += power;
    }
    if (freq >= MAINS_HZ - 2 && freq <= MAINS_HZ + 2) {
      mainsPower += power;
    }
  }

  if (totalPower + mainsPower === 0) return 0;
  return mainsPower / (totalPower + mainsPower);
}

/**
 * FFT radix-2 in-place simple para fitCheck.
 */
function fftForward(re: Float32Array, im: Float32Array, n: number): void {
  // Bit-reversal
  for (let i = 0; i < n; i++) {
    let j = 0;
    for (let bit = 0; bit < Math.log2(n); bit++) {
      j = (j << 1) | ((i >> bit) & 1);
    }
    if (i < j) {
      const tmpRe = re[i]; re[i] = re[j]; re[j] = tmpRe;
      const tmpIm = im[i]; im[i] = im[j]; im[j] = tmpIm;
    }
  }

  // Mariposas
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    for (let block = 0; block < n; block += len) {
      for (let j = 0; j < half; j++) {
        const angle = (-2 * Math.PI * j) / len;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);

        const uRe = re[block + j];
        const uIm = im[block + j];
        const vRe = re[block + j + half];
        const vIm = im[block + j + half];

        const vwRe = vRe * wr - vIm * wi;
        const vwIm = vRe * wi + vIm * wr;

        re[block + j] = uRe + vwRe;
        im[block + j] = uIm + vwIm;
        re[block + j + half] = uRe - vwRe;
        im[block + j + half] = uIm - vwIm;
      }
    }
  }
}
