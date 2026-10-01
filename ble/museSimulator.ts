import { EegPacket, EegChannel, Vec3 } from '@/types/muse';
import { SAMPLE_RATE_HZ, SAMPLES_PER_EEG_PACKET } from '@/constants/muse';
import { dspEngine } from '@/dsp/dspEngine';
import { useMuseStore } from '@/store/useMuseStore';

const CHANNELS: EegChannel[] = ['TP9', 'AF7', 'AF8', 'TP10'];

const FREQS: Record<EegChannel, number> = {
  TP9: 10,   // Alpha
  AF7: 20,   // Beta
  AF8: 40,   // Gamma
  TP10: 6,   // Theta
};

const NOISE_LEVEL = 5; // 5 µV noise

export class MuseSimulator {
  private interval: ReturnType<typeof setInterval> | null = null;
  private telemetryInterval: ReturnType<typeof setInterval> | null = null;
  private sequence = 0;
  private startTime = 0;
  private sampleCount = 0;

  start(): void {
    if (this.interval) return;

    this.startTime = Date.now();
    this.sampleCount = 0;
    this.sequence = 0;

    // Packet interval: 1000 / (256/12) = 46.875ms
    const intervalMs = (1000 * SAMPLES_PER_EEG_PACKET) / SAMPLE_RATE_HZ;

    this.interval = setInterval(() => {
      this.generatePackets();
    }, intervalMs);

    this.telemetryInterval = setInterval(() => {
      this.generateTelemetry();
    }, 1000); // 1 Hz telemetry
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
  }
}

export const museSimulator = new MuseSimulator();
