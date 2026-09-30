import { computeFit, FIT_THRESHOLDS } from '@/dsp/fitCheck';
import { ChannelMap, FitCheck } from '@/types/muse';

function generateGaussianNoise(sigma: number, n: number): Float32Array {
  const result = new Float32Array(n);
  // Use deterministic seed for reproducible tests
  let seed = 12345;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < n; i++) {
    const u1 = random();
    const u2 = random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    result[i] = z * sigma;
  }
  return result;
}

describe('computeFit', () => {
  const emptyCounters: ChannelMap<number> = { TP9: 0, AF7: 0, AF8: 0, TP10: 0 };

  it('returns 0 (good) for gaussian noise with sigma=15 after hysteresis', () => {
    const windows: ChannelMap<Float32Array> = {
      TP9: generateGaussianNoise(15, 256),
      AF7: generateGaussianNoise(15, 256),
      AF8: generateGaussianNoise(15, 256),
      TP10: generateGaussianNoise(15, 256),
    };
    const previous: FitCheck = { TP9: 2, AF7: 2, AF8: 2, TP10: 2 };
    const counters = { ...emptyCounters };

    // Primera evaluación: incrementa contador pero no cambia
    computeFit(windows, previous, counters);
    // Segunda evaluación: cambia
    const result = computeFit(windows, previous, counters);

    expect(result.fit.TP9).toBe(0);
    expect(result.fit.AF7).toBe(0);
    expect(result.fit.AF8).toBe(0);
    expect(result.fit.TP10).toBe(0);
    expect(result.headbandOn).toBe(true);
  });

  it('returns 2 (poor) for flat signal after hysteresis', () => {
    const windows: ChannelMap<Float32Array> = {
      TP9: new Float32Array(256).fill(5),
      AF7: new Float32Array(256).fill(5),
      AF8: new Float32Array(256).fill(5),
      TP10: new Float32Array(256).fill(5),
    };
    const previous: FitCheck = { TP9: 0, AF7: 0, AF8: 0, TP10: 0 };
    const counters = { ...emptyCounters };

    computeFit(windows, previous, counters);
    const result = computeFit(windows, previous, counters);

    expect(result.fit.TP9).toBe(2);
    expect(result.headbandOn).toBe(false);
  });

  it('returns 2 (poor) for saturated signal after hysteresis', () => {
    const windows: ChannelMap<Float32Array> = {
      TP9: new Float32Array(256).fill(999),
      AF7: new Float32Array(256).fill(999),
      AF8: new Float32Array(256).fill(999),
      TP10: new Float32Array(256).fill(999),
    };
    const previous: FitCheck = { TP9: 0, AF7: 0, AF8: 0, TP10: 0 };
    const counters = { ...emptyCounters };

    computeFit(windows, previous, counters);
    const result = computeFit(windows, previous, counters);

    expect(result.fit.TP9).toBe(2);
  });

  it('requires 2 consecutive evaluations for hysteresis', () => {
    const windows: ChannelMap<Float32Array> = {
      TP9: generateGaussianNoise(15, 256),
      AF7: generateGaussianNoise(15, 256),
      AF8: generateGaussianNoise(15, 256),
      TP10: generateGaussianNoise(15, 256),
    };
    const previous: FitCheck = { TP9: 2, AF7: 2, AF8: 2, TP10: 2 };
    const counters = { ...emptyCounters };

    // Primera evaluación: no cambia por histéresis
    const result1 = computeFit(windows, previous, counters);
    expect(result1.fit.TP9).toBe(2);

    // Segunda evaluación: cambia
    const result2 = computeFit(windows, result1.fit, counters);
    expect(result2.fit.TP9).toBe(0);
  });
});
