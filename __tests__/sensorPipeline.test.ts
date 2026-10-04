import { decodePpg } from '@/ble/museDecoder';
import { highPassDisplayWindow } from '@/dsp/displaySignal';

jest.mock('@/store/useMuseStore', () => {
  const state = { setHeartRate: jest.fn(), setBands: jest.fn(), setFit: jest.fn(), setStats: jest.fn() };
  return { useMuseStore: { getState: () => state } };
});
import { useMuseStore } from '@/store/useMuseStore';
import { dspEngine } from '@/dsp/dspEngine';

describe('Muse 2 sensor pipeline', () => {
  afterEach(() => dspEngine.stop());
  it('decodes all six unsigned 24-bit PPG values, including high-bit values', () => {
    const values = [0, 1, 255, 65536, 8388608, 16777215];
    const packet = new Uint8Array(20);
    packet[0] = 18; packet[1] = 52;
    values.forEach((value, index) => {
      const offset = 2 + index * 3;
      packet[offset] = value >>> 16;
      packet[offset + 1] = value >>> 8;
      packet[offset + 2] = value;
    });
    expect(decodePpg(packet, 100)).toEqual({ sequence: 4660, samples: values, receivedAtMs: 100 });
  });
  it.each([0, 6, 8, 19, 21])('rejects incomplete or unexpected PPG length %i', (size) => {
    expect(() => decodePpg(new Uint8Array(size), 0)).toThrow();
  });
  it('removes a constant display offset without a startup spike', () => {
    const samples = new Float32Array(512).fill(500);
    highPassDisplayWindow(samples, samples.length);
    expect(samples.every((value) => value === 0)).toBe(true);
  });
  it('redrawing identical history gives identical filtered values', () => {
    const raw = Float32Array.from({ length: 512 }, (_, i) => 400 + 20 * Math.sin(i * 2 * Math.PI * 10 / 256));
    const first = raw.slice(); const second = raw.slice();
    highPassDisplayWindow(first, first.length);
    highPassDisplayWindow(second, second.length);
    expect(first).toEqual(second);
    expect(raw[0]).toBe(400);
    expect(Math.max(...first)).toBeGreaterThan(10);
  });
  it('does not invent dropped EEG packets when the initial sequence is nonzero', () => {
    dspEngine.start();
    dspEngine.pushEeg({ channel: 'TP9', sequence: 20, samplesUv: new Float32Array(12).fill(10), receivedAtMs: 100 });
    dspEngine.pushEeg({ channel: 'TP9', sequence: 21, samplesUv: new Float32Array(12).fill(20), receivedAtMs: 150 });
    const output = new Float32Array(256);
    expect(dspEngine.getScopeWindow('TP9', 1, output)).toBe(24);
    expect(output[12]).toBe(20);
  });
  it('estimates a 72 BPM optical fixture using six samples per packet', () => {
    dspEngine.start();
    const report = jest.mocked(useMuseStore.getState().setHeartRate);
    report.mockClear();
    const baseTime = 100000;
    for (let index = 0; index < 960; index += 6) {
      const samples = Array.from({ length: 6 }, (_, offset) =>
        100000 + 5000 * Math.sin(2 * Math.PI * 1.2 * (index + offset) / 64));
      dspEngine.pushPpg({ sequence: index / 6, samples, receivedAtMs: baseTime + (index + 5) * 1000 / 64 });
    }
    const reports = report.mock.calls.map(([bpm]) => bpm).filter((bpm): bpm is number => bpm !== null);
    expect(reports.length).toBeGreaterThan(3);
    expect(reports[reports.length - 1]).toBeGreaterThanOrEqual(70);
    expect(reports[reports.length - 1]).toBeLessThanOrEqual(74);
  });
  it('clears old EEG samples on a new acquisition', () => {
    dspEngine.start();
    dspEngine.pushEeg({ channel: 'TP9', sequence: 1, samplesUv: new Float32Array(12), receivedAtMs: 0 });
    dspEngine.start();
    expect(dspEngine.getScopeWindow('TP9', 1, new Float32Array(256))).toBe(0);
  });
});
