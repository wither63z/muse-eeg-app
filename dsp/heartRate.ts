/** Experimental periodicity estimator for Muse classic PPG at 64 Hz.
 * Returns null for short, flat, clipped or nonperiodic windows. Not clinically validated.
 * Uses sample spacing, not BLE arrival times. Thresholds are empirical.
 */
export function estimateHeartRate(raw: Float32Array, sampleRate = 64): number | null {
  const n = raw.length;
  if (n < sampleRate * 8) return null;
  let mean = 0;
  let clipped = 0;
  for (const value of raw) {
    if (!Number.isFinite(value)) return null;
    mean += value;
    if (value <= 0 || value >= 0xffffff) clipped++;
  }
  mean /= n;
  if (mean <= 0 || clipped / n > 0.02) return null;

  // Remove slow optical baseline and smooth fast fluctuations (two low-pass stages).
  const signal = new Float64Array(n);
  const highPassAlpha = Math.exp(-2 * Math.PI * 0.5 / sampleRate);
  const lowPassAlpha = 1 - Math.exp(-2 * Math.PI * 4 / sampleRate);
  let previousInput = raw[0], highPass = 0, lowPass = 0, smoothed = 0;
  for (let i = 0; i < n; i++) {
    highPass = highPassAlpha * (highPass + raw[i] - previousInput);
    previousInput = raw[i];
    lowPass += lowPassAlpha * (highPass - lowPass);
    smoothed += lowPassAlpha * (lowPass - smoothed);
    signal[i] = smoothed;
  }
  // Discard filter warmup, and require variation relative to the optical baseline.
  const start = sampleRate;
  let energy = 0;
  for (let i = start; i < n; i++) energy += signal[i] * signal[i];
  if (Math.sqrt(energy / (n - start)) / mean < 0.0005) return null;

  const minimumLag = Math.floor(sampleRate * 60 / 220);
  const maximumLag = Math.ceil(sampleRate * 60 / 30);
  const correlation = new Float64Array(maximumLag + 2);
  for (let lag = minimumLag - 1; lag <= maximumLag + 1; lag++) {
    let cross = 0, firstEnergy = 0, secondEnergy = 0;
    for (let i = start + lag; i < n; i++) {
      cross += signal[i] * signal[i - lag];
      firstEnergy += signal[i] * signal[i];
      secondEnergy += signal[i - lag] * signal[i - lag];
    }
    correlation[lag] = cross / Math.sqrt(firstEnergy * secondEnergy || 1);
  }
  let best = 0;
  for (let lag = minimumLag; lag <= maximumLag; lag++) {
    if (correlation[lag] >= correlation[lag - 1] && correlation[lag] > correlation[lag + 1]) {
      best = Math.max(best, correlation[lag]);
    }
  }
  if (best < 0.75) return null;
  // Use the first strong full-period peak; weaker dicrotic peaks are rejected.
  for (let lag = minimumLag; lag <= maximumLag; lag++) {
    if (correlation[lag] >= Math.max(0.75, best * 0.95) &&
        correlation[lag] >= correlation[lag - 1] && correlation[lag] > correlation[lag + 1]) {
      const denominator = correlation[lag - 1] - 2 * correlation[lag] + correlation[lag + 1];
      const correction = denominator === 0 ? 0 :
        Math.max(-0.5, Math.min(0.5, 0.5 * (correlation[lag - 1] - correlation[lag + 1]) / denominator));
      const bpm = Math.round(60 * sampleRate / (lag + correction));
      return bpm >= 30 && bpm <= 220 ? bpm : null;
    }
  }
  return null;
}
