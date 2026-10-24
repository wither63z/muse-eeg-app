import type { SensorSample, TimedSample } from '@/types/muse';
jest.mock('@/store/useMuseStore', () => ({
  useMuseStore: {
    setState: jest.fn(),
    getState: () => ({
      setHeartRate: jest.fn(),
      setBands: jest.fn(),
      setFit: jest.fn(),
      setStats: jest.fn(),
      setBattery: jest.fn(),
      setMotion: jest.fn(),
    }),
  },
}));
import { MuseSimulator } from '@/ble/museSimulator';
import { dspEngine } from '@/dsp/dspEngine';

it('simulates six unsigned optical samples and labels every exported flow synthetic', () => {
  jest.useFakeTimers();
  const simulator = new MuseSimulator();
  const sensors: SensorSample[] = [],
    eeg: TimedSample[] = [];
  const removeSensor = dspEngine.onSensorSample((row) => sensors.push(row));
  const removeEeg = dspEngine.onRawSample((row) => eeg.push(row));
  try {
    dspEngine.start('simulation');
    simulator.start();
    jest.advanceTimersByTime(1100);
    expect(new Set(sensors.map((row) => row.stream))).toEqual(
      new Set(['ppg', 'battery', 'accel', 'gyro']),
    );
    const optical = sensors.filter((row) => row.stream === 'ppg' && row.sequence === 0);
    expect(optical.map((row) => row.sampleIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(optical.every((row) => row.value! >= 0 && row.value! <= 0xffffff)).toBe(true);
    expect(sensors.every((row) => row.source === 'simulation')).toBe(true);
    expect(eeg.length).toBeGreaterThan(12);
    expect(
      eeg.every((row) => row.source === 'simulation' && row.receivedMonotonicMs !== undefined),
    ).toBe(true);
  } finally {
    simulator.stop();
    dspEngine.stop();
    removeSensor();
    removeEeg();
    jest.useRealTimers();
  }
});
