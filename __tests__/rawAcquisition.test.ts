import { RAW_CSV_HEADER, formatRawSample } from '@/recording/csvFormat';
import type { TimedSample } from '@/types/muse';
jest.mock('@/store/useMuseStore', () => ({
  useMuseStore: {
    getState: () => ({
      setHeartRate: jest.fn(),
      setBands: jest.fn(),
      setFit: jest.fn(),
      setStats: jest.fn(),
    }),
  },
}));
import { dspEngine } from '@/dsp/dspEngine';

describe('raw acquisition integrity', () => {
  afterEach(() => dspEngine.stop());
  it('retains duplicate raw notifications with flags, does not invent gap samples', () => {
    dspEngine.start();
    const rows: TimedSample[] = [],
      remove = dspEngine.onRawSample((s) => rows.push(s));
    const send = (sequence: number) =>
      dspEngine.pushEeg({
        channel: 'TP9',
        sequence,
        samplesUv: new Float32Array(12).fill(sequence),
        receivedAtMs: 1000,
        receivedMonotonicMs: 50,
      });
    try {
      send(65535);
      send(0);
      send(0);
      send(2);
      expect(rows).toHaveLength(48);
      expect(rows[24].isDuplicate).toBe(true);
      expect(rows[36].gapPackets).toBe(1);
      expect(rows[0].tMs).toBe(1000);
      expect(rows[0].receivedMonotonicMs).toBe(50);
      const buffer = new Float32Array(100),
        count = dspEngine.getScopeWindow('TP9', 1, buffer);
      expect(count).toBe(37);
      expect(Number.isNaN(buffer[24])).toBe(true);
      expect(rows.every((r) => r.acquisitionEpoch === rows[0].acquisitionEpoch)).toBe(true);
      dspEngine.start();
      send(1);
      expect(rows[48].acquisitionEpoch).not.toBe(rows[0].acquisitionEpoch);
    } finally {
      remove();
    }
  });
  it('exports one channel without stale values from other channels or rounding raw precision', () => {
    const row = formatRawSample({
      channel: 'AF7',
      uv: 0.48828125,
      tMs: 0,
      sequence: 2,
      sampleIndex: 3,
      receivedMonotonicMs: 1.25,
      acquisitionEpoch: 1,
      source: 'muse',
    });
    const cells = Object.fromEntries(
      RAW_CSV_HEADER.split(',').map((key, i) => [key, row.split(',')[i]]),
    );
    expect(cells.value).toBe('0.48828125');
    expect(cells.channel).toBe('AF7');
    expect(cells.received_at_utc).toBe('1970-01-01T00:00:00.000Z');
    expect(cells.unit).toBe('uV');
  });
  it('raw peripheral rows preserve all packet samples and simulation provenance', () => {
    dspEngine.start('simulation');
    const rows: string[] = [];
    const remove = dspEngine.onSensorSample((s) => rows.push(formatRawSample(s)));
    try {
      for (let i = 0; i < 6; i++)
        dspEngine.pushSensor({
          stream: 'ppg',
          sequence: 1,
          sampleIndex: i,
          value: 100 + i,
          receivedAtMs: 0,
          receivedMonotonicMs: 1,
        });
      expect(rows).toHaveLength(6);
      expect(rows.every((row) => row.includes(',simulation,ppg,'))).toBe(true);
      expect(rows[5]).toContain(',5,105,');
    } finally {
      remove();
    }
  });
});
