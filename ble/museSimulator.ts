import { EegPacket, EegChannel, Vec3, PpgSample } from '@/types/muse';
import { SAMPLE_RATE_HZ, SAMPLES_PER_EEG_PACKET, PPG_SAMPLE_RATE_HZ } from '@/constants/muse';
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
  private ppgInterval: ReturnType<typeof setInterval> | null = null;
  private sequence = 0;
  private ppgSequence = 0;
  private startTime = 0;
  private sampleCount = 0;
  private ppgSampleCount = 0;

  start(): void {
    if (this.interval) return;

    this.startTime = Date.now();
    this.sampleCount = 0;
    this.sequence = 0;
    this.ppgSampleCount = 0;
    this.ppgSequence = 0;

    // Packet interval: 1000 / (256/12) = 46.875ms
    const intervalMs = (1000 * SAMPLES_PER_EEG_PACKET) / SAMPLE_RATE_HZ;

    this.interval = setInterval(() => {
      this.generatePackets();
    }, intervalMs);

    this.telemetryInterval = setInterval(() => {
      this.generateTelemetry();
    }, 1000); // 1 Hz telemetry

    // PPG: 3 muestras por paquete a 64 Hz → intervalo ≈ 46.875 ms
    const ppgIntervalMs = (1000 * 3) / PPG_SAMPLE_RATE_HZ;
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

  private generatePpg(): void {
    const now = Date.now();
    const t = this.ppgSampleCount / PPG_SAMPLE_RATE_HZ;

    // Simular señal PPG: onda tipo pulso cardíaco (~70 BPM = ~857ms período)
    const heartRate = 70; // BPM
    const period = 60000 / heartRate; // ms
    const phase = (t * 1000) % period;

    // Generar 3 muestras
    const samples: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const sampleTime = t + i / PPG_SAMPLE_RATE_HZ;
      const samplePhase = (sampleTime * 1000) % period;
      const normalizedPhase = samplePhase / period;

      // Forma de onda PPG realista: pico rápido + dicrotico notch + decaimiento
      let value = 0;
      if (normalizedPhase < 0.2) {
        // Subida sistólica
        value = Math.sin(normalizedPhase / 0.2 * Math.PI / 2);
      } else if (normalizedPhase < 0.35) {
        // Pico y notch dicrotico
        value = Math.cos((normalizedPhase - 0.2) / 0.15 * Math.PI / 2) * 0.8;
      } else if (normalizedPhase < 0.8) {
        // Decaimiento diastólico
        value = 0.3 * Math.exp(-(normalizedPhase - 0.35) / 0.45 * 3);
      }
      // Ruido fisiológico
      value += (Math.random() - 0.5) * 0.05;
      // Escalar a rango típico ADC (signed 24-bit range)
      samples[i as 0 | 1 | 2] = Math.round(value * 100000);
    }

    const packet: PpgSample = {
      sequence: this.ppgSequence,
      samples,
      receivedAtMs: now,
    };

    dspEngine.pushPpg(packet);

    this.ppgSampleCount += 3;
    this.ppgSequence = (this.ppgSequence + 1) % 65536;
  }
}

export const museSimulator = new MuseSimulator();
