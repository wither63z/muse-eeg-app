import { Fft, hannWindow } from '@/dsp/fft';

describe('Fft', () => {
  it('finds peak at correct bin for 10 Hz sine', () => {
    const N = 256;
    const fs = 256;
    const fft = new Fft(N);
    const re = new Float32Array(N);
    const im = new Float32Array(N);

    // Seno de 10 Hz
    for (let i = 0; i < N; i++) {
      re[i] = Math.sin((2 * Math.PI * 10 * i) / fs);
    }

    fft.forward(re, im);

    // Encontrar bin de máxima magnitud
    let maxMag = 0;
    let maxBin = 0;
    for (let k = 0; k <= N / 2; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      if (mag > maxMag) {
        maxMag = mag;
        maxBin = k;
      }
    }

    expect(maxBin).toBe(10);
  });

  it('finds peak at correct bin for 20 Hz sine', () => {
    const N = 256;
    const fs = 256;
    const fft = new Fft(N);
    const re = new Float32Array(N);
    const im = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      re[i] = Math.sin((2 * Math.PI * 20 * i) / fs);
    }

    fft.forward(re, im);

    let maxMag = 0;
    let maxBin = 0;
    for (let k = 0; k <= N / 2; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      if (mag > maxMag) {
        maxMag = mag;
        maxBin = k;
      }
    }

    expect(maxBin).toBe(20);
  });

  it('DC signal has power only at bin 0', () => {
    const N = 256;
    const fft = new Fft(N);
    const re = new Float32Array(N);
    const im = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      re[i] = 5; // DC
    }

    fft.forward(re, im);

    // Bin 0 debe tener magnitud significativa
    expect(Math.abs(re[0])).toBeGreaterThan(0);
    // Otros bins deben ser ~0
    for (let k = 1; k <= N / 2; k++) {
      expect(Math.abs(re[k])).toBeLessThan(0.001);
    }
  });
});

describe('hannWindow', () => {
  it('returns correct values', () => {
    const w = hannWindow(4);
    expect(w[0]).toBeCloseTo(0, 5);
    expect(w[1]).toBeCloseTo(0.75, 5);
    expect(w[2]).toBeCloseTo(0.75, 5);
    expect(w[3]).toBeCloseTo(0, 5);
  });
});
