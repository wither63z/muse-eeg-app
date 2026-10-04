import { estimateHeartRate } from '@/dsp/heartRate';
import { inspectSignalQuality } from '@/dsp/fitCheck';

function waveform(bpm: number, harmonic = 0): Float32Array {
  return Float32Array.from({ length: 512 }, (_, i) => {
    const phase = 2 * Math.PI * bpm / 60 * i / 64;
    return 100000 + 5000 * (Math.sin(phase) + harmonic * Math.sin(phase * 2));
  });
}

describe('quality-gated optical heart rate', () => {
  it.each([45, 72, 90, 120, 180])('estimates a periodic %i BPM signal without forcing a resting range', (bpm) => {
    expect(Math.abs((estimateHeartRate(waveform(bpm)) ?? 0) - bpm)).toBeLessThanOrEqual(2);
  });
  it('rejects a window shorter than eight seconds', () => {
    expect(estimateHeartRate(waveform(72).slice(0, 256))).toBeNull();
  });
  it('rejects flat or saturated optical signals', () => {
    expect(estimateHeartRate(new Float32Array(512).fill(100000))).toBeNull();
    expect(estimateHeartRate(new Float32Array(512).fill(0xffffff))).toBeNull();
  });
  it('does not count a weaker secondary pulse as another heartbeat', () => {
    expect(Math.abs((estimateHeartRate(waveform(90, 0.8)) ?? 0) - 90)).toBeLessThanOrEqual(2);
  });
  it('rejects deterministic broadband noise instead of displaying 180 BPM', () => {
    let seed = 12345;
    const noise = Float32Array.from({ length: 512 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return 100000 + (seed / 4294967296 - 0.5) * 10000;
    });
    expect(estimateHeartRate(noise)).toBeNull();
  });
});

describe('EEG quality diagnostics', () => {
  it('distinguishes no data, flat signal and real clipping', () => {
    expect(inspectSignalQuality(new Float32Array()).reason).toBe('Esperando datos');
    expect(inspectSignalQuality(new Float32Array(256).fill(20)).reason).toBe('Señal plana');
    expect(inspectSignalQuality(new Float32Array(256).fill(999)).reason).toBe('Señal saturada');
  });
  it('does not label an isolated spike as whole-window saturation', () => {
    const eeg = Float32Array.from({ length: 256 }, (_, i) => 20 * Math.sin(2 * Math.PI * i * 10 / 256));
    eeg[100] = 999;
    expect(inspectSignalQuality(eeg).reason).not.toBe('Señal saturada');
  });
  it('recognizes a clean EEG signal despite a DC offset', () => {
    const eeg = Float32Array.from({ length: 256 }, (_, i) => 600 + 20 * Math.sin(2 * Math.PI * i * 10 / 256));
    expect(inspectSignalQuality(eeg).level).toBe(0);
  });
  it('identifies strong 60 Hz interference', () => {
    const eeg = Float32Array.from({ length: 256 }, (_, i) => 20 * Math.sin(2 * Math.PI * i * 60 / 256));
    expect(inspectSignalQuality(eeg).reason).toBe('Interferencia de red');
  });
});
