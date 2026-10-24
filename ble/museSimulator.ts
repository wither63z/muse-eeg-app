import { EegPacket, EegChannel, Vec3, PpgSample } from '@/types/muse';
import { SAMPLE_RATE_HZ, SAMPLES_PER_EEG_PACKET, PPG_SAMPLE_RATE_HZ } from '@/constants/muse';
import { dspEngine } from '@/dsp/dspEngine';
import { useMuseStore } from '@/store/useMuseStore';

const CHANNELS: EegChannel[] = ['TP9', 'AF7', 'AF8', 'TP10'];

const FREQS: Record<EegChannel, number> = {
  TP9: 10, // Alpha
  AF7: 20, // Beta
  AF8: 40, // Gamma
  TP10: 6, // Theta
};

const NOISE_LEVEL = 5; // 5 µV noise

export class MuseSimulator {
  private interval: ReturnType<typeof setInterval> | null = null;
  private telemetryInterval: ReturnType<typeof setInterval> | null = null;
  private ppgInterval: ReturnType<typeof setInterval> | null = null;
  private sequence = 0;
  private ppgSequence = 0;
  private startTime = 0;
  private sampleCount = 0;
  private ppgSampleCount = 0;
  private telemetrySequence = 0;

  start(): void {
    if (this.interval) return;

    this.startTime = Date.now();
    this.sampleCount = 0;
    this.sequence = 0;
    this.ppgSampleCount = 0;
    this.ppgSequence = 0;
    this.telemetrySequence = 0;

    // Packet interval: 1000 / (256/12) = 46.875ms
    const intervalMs = (1000 * SAMPLES_PER_EEG_PACKET) / SAMPLE_RATE_HZ;

    this.interval = setInterval(() => {
      this.generatePackets();
    }, intervalMs);

    this.telemetryInterval = setInterval(() => {
      this.generateTelemetry();
    }, 1000); // 1 Hz telemetry

    // Same six-sample packet layout as the classic Muse optical stream.
    const ppgIntervalMs = (1000 * 6) / PPG_SAMPLE_RATE_HZ;
    this.ppgInterval = setInterval(() => {
      this.generatePpg();
    }, ppgIntervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
      this.telemetryInterval = null;
    }
    if (this.ppgInterval) {
      clearInterval(this.ppgInterval);
      this.ppgInterval = null;
    }
  }

  isRunning(): boolean {
    return this.interval !== null;
  }

  private generatePackets(): void {
    const now = Date.now();

    for (const channel of CHANNELS) {
      const samplesUv = new Float32Array(SAMPLES_PER_EEG_PACKET);
      const freq = FREQS[channel];

      for (let i = 0; i < SAMPLES_PER_EEG_PACKET; i++) {
        const t = (this.sampleCount + i) / SAMPLE_RATE_HZ;
        // Sine wave + random noise
        const signal = 20 * Math.sin(2 * Math.PI * freq * t);
        const noise = (Math.random() - 0.5) * 2 * NOISE_LEVEL;
        samplesUv[i] = signal + noise;
      }

      const packet: EegPacket = {
        channel,
        sequence: this.sequence,
        samplesUv,
        receivedAtMs: now,
        receivedMonotonicMs: performance.now(),
      };

      dspEngine.pushEeg(packet);
    }

    this.sampleCount += SAMPLES_PER_EEG_PACKET;
    this.sequence = (this.sequence + 1) % 65536;
  }

  private generateTelemetry(): void {
    const store = useMuseStore.getState();
    const now = Date.now();

    // Battery: 90-100% oscillating slowly
    const batteryPercent = 95 + 5 * Math.sin(now / 10000);
    store.setBattery({
      sequence: this.sequence,
      percent: batteryPercent,
      voltageMv: 4000,
      receivedAtMs: now,
    });

    // Motion: small random drift
    const accel: Vec3 = {
      x: (Math.random() - 0.5) * 0.1,
      y: (Math.random() - 0.5) * 0.1,
      z: 1.0 + (Math.random() - 0.5) * 0.1, // Near 1g
    };
    const gyro: Vec3 = {
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: (Math.random() - 0.5) * 2,
    };

    store.setMotion(accel, gyro, now);
    const mono = performance.now(),
      sequence = this.telemetrySequence++;
    dspEngine.pushSensor({
      stream: 'battery',
      sequence,
      sampleIndex: 0,
      value: batteryPercent,
      receivedAtMs: now,
      receivedMonotonicMs: mono,
    });
    dspEngine.pushSensor({
      stream: 'accel',
      sequence,
      sampleIndex: 0,
      axes: accel,
      receivedAtMs: now,
      receivedMonotonicMs: mono,
    });
    dspEngine.pushSensor({
      stream: 'gyro',
      sequence,
      sampleIndex: 0,
      axes: gyro,
      receivedAtMs: now,
      receivedMonotonicMs: mono,
    });
  }

  private generatePpg(): void {
    const now = Date.now(),
      mono = performance.now();
    const samples = Array.from({ length: 6 }, (_, i) =>
      Math.round(
        100000 +
          5000 *
            Math.sin((2 * Math.PI * (70 / 60) * (this.ppgSampleCount + i)) / PPG_SAMPLE_RATE_HZ),
      ),
    );
    dspEngine.pushPpg({ sequence: this.ppgSequence, samples, receivedAtMs: now });
    samples.forEach((value, sampleIndex) =>
      dspEngine.pushSensor({
        stream: 'ppg',
        sequence: this.ppgSequence,
        sampleIndex,
        value,
        receivedAtMs: now,
        receivedMonotonicMs: mono,
      }),
    );
    this.ppgSampleCount += 6;
    this.ppgSequence = (this.ppgSequence + 1) % 65536;
  }
}

export const museSimulator = new MuseSimulator();
