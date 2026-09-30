/**
 * FFT radix-2 iterativa in-place. N debe ser potencia de 2.
 * Sin normalización — la normalización se hace en dspEngine.
 */
export class Fft {
  private cosTable: Float32Array;
  private sinTable: Float32Array;
  private bitReversal: Uint32Array;

  constructor(readonly size: number) {
    if ((size & (size - 1)) !== 0) {
      throw new Error(`FFT size must be a power of 2, got ${size}`);
    }

    // Precalcular tabla de trig
    this.cosTable = new Float32Array(size);
    this.sinTable = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const angle = (2 * Math.PI * i) / size;
      this.cosTable[i] = Math.cos(angle);
      this.sinTable[i] = Math.sin(angle);
    }

    // Precalcular permutación bit-reversal
    this.bitReversal = new Uint32Array(size);
    const bits = Math.log2(size);
    for (let i = 0; i < size; i++) {
      let reversed = 0;
      for (let j = 0; j < bits; j++) {
        reversed = (reversed << 1) | ((i >> j) & 1);
      }
      this.bitReversal[i] = reversed;
    }
  }

  /**
   * Transformada directa in-place. re e im son Float32Array(size).
   */
  forward(re: Float32Array, im: Float32Array): void {
    const N = this.size;

    // Permutación bit-reversal
    for (let i = 0; i < N; i++) {
      const j = this.bitReversal[i];
      if (i < j) {
        // Intercambiar re
        const tmpRe = re[i];
        re[i] = re[j];
        re[j] = tmpRe;
        // Intercambiar im
        const tmpIm = im[i];
        im[i] = im[j];
        im[j] = tmpIm;
      }
    }

    // Mariposas
    for (let len = 2; len <= N; len <<= 1) {
      const half = len >> 1;
      const step = N / len;

      for (let block = 0; block < N; block += len) {
        for (let j = 0; j < half; j++) {
          const idx = j * step;
          const wr = this.cosTable[idx];
          const wi = -this.sinTable[idx];

          const uRe = re[block + j];
          const uIm = im[block + j];
          const vRe = re[block + j + half];
          const vIm = im[block + j + half];

          // v * w
          const vwRe = vRe * wr - vIm * wi;
          const vwIm = vRe * wi + vIm * wr;

          // Mariposa
          re[block + j] = uRe + vwRe;
          im[block + j] = uIm + vwIm;
          re[block + j + half] = uRe - vwRe;
          im[block + j + half] = uIm - vwIm;
        }
      }
    }
  }
}

/**
 * Ventana Hann: w[i] = 0.5 * (1 - cos(2πi/(n-1)))
 */
export function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  return w;
}
