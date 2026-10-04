import type { RecordingMeta, TimedSample } from '@/types/muse';

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@/dsp/dspEngine', () => {
  let callback: ((sample: TimedSample) => void) | null = null;
  return { dspEngine: {
    onRawSample: (cb: (sample: TimedSample) => void) => { callback = cb; return () => { callback = null; }; },
    onBands: () => () => {},
    emit: (sample: TimedSample) => callback?.(sample),
  } };
});
jest.mock('@/store/useMuseStore', () => {
  const state = {
    status: 'streaming', telemetry: { accel: null, gyro: null, battery: null },
    fit: { TP9: 2, AF7: 2, AF8: 2, TP10: 2 }, headbandOn: false,
    setRecording: jest.fn(), setRecordingRowCount: jest.fn(),
  };
  return { useMuseStore: { getState: () => state } };
});
import { recorder, RecordingSink } from '@/recording/recorder';
import { dspEngine } from '@/dsp/dspEngine';

class MemorySink implements RecordingSink {
  readonly dir = 'test-session';
  readonly rows: string[] = [];
  metadata: RecordingMeta | null = null;
  async write(rows: string[]) { this.rows.push(...rows); }
  async close(meta: RecordingMeta) { this.metadata = meta; return this.dir; }
  getTotalRows() { return this.rows.length; }
}
const acquisition = dspEngine as typeof dspEngine & { emit(sample: TimedSample): void };

describe('Recorder lifecycle with a real injected sink', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it('writes acquired samples, returns the actual row count and unsubscribes on stop', async () => {
    const sink = new MemorySink();
    await recorder.start(sink);
    acquisition.emit({ channel: 'TP9', uv: 12, tMs: Date.now() });
    acquisition.emit({ channel: 'AF7', uv: 24, tMs: Date.now() });
    const meta = await recorder.stop();
    expect(sink.rows).toHaveLength(2);
    expect(meta.rowCount).toBe(2);
    expect(sink.metadata?.rowCount).toBe(2);
    acquisition.emit({ channel: 'TP9', uv: 99, tMs: Date.now() });
    expect(sink.rows).toHaveLength(2);
  });
  it('writes each named marker only on its next sample', async () => {
    const sink = new MemorySink();
    await recorder.start(sink);
    recorder.addMarker('M1');
    acquisition.emit({ channel: 'TP9', uv: 12, tMs: Date.now() });
    acquisition.emit({ channel: 'TP9', uv: 13, tMs: Date.now() });
    recorder.addMarker('M2');
    acquisition.emit({ channel: 'TP9', uv: 14, tMs: Date.now() });
    await recorder.stop();
    expect(sink.rows[0]).toMatch(/,M1$/);
    expect(sink.rows[1]).not.toMatch(/,M[12]$/);
    expect(sink.rows[2]).toMatch(/,M2$/);
  });
});
