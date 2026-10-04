import { toByteArray } from 'base64-js';
import { EegChannel, EegPacket, BatteryReading, MotionSample, Vec3, PpgSample } from '@/types/muse';
import { EEG_UV_PER_LSB, EEG_ADC_MIDPOINT, ACCEL_G_PER_LSB, GYRO_DPS_PER_LSB, SAMPLE_RATE_HZ, SAMPLES_PER_EEG_PACKET } from '@/constants/muse';

/**
 * Convierte base64 a Uint8Array.
 */
export function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(toByteArray(b64));
}

/**
 * Decodifica un paquete EEG de 20 bytes.
 * 
 * Layout: [seqHi, seqLo, ...18 bytes]
 * Los 18 bytes contienen 12 muestras de 12 bits big-endian empaquetadas.
 * Muestras pares (0,2,4…) ocupan byte[k] completo + nibble alto de byte[k+1].
 * Las impares ocupan nibble bajo de byte[k] + byte[k+1] completo.
 */
export function decodeEegPacket(
  channel: EegChannel,
  bytes: Uint8Array,
  receivedAtMs: number,
): EegPacket {
  if (bytes.length !== 20) {
    throw new Error(`EEG packet length ${bytes.length} != 20`);
  }

  const sequence = (bytes[0] << 8) | bytes[1];
  const samplesUv = new Float32Array(SAMPLES_PER_EEG_PACKET);

  for (let i = 0; i < SAMPLES_PER_EEG_PACKET; i++) {
    const k = 2 + ((i * 12) >> 3);
    const raw = (i & 1) === 0
      ? (bytes[k] << 4) | (bytes[k + 1] >> 4)
      : ((bytes[k] & 0x0f) << 8) | bytes[k + 1];
    samplesUv[i] = (raw - EEG_ADC_MIDPOINT) * EEG_UV_PER_LSB;
  }

  return { channel, sequence, samplesUv, receivedAtMs };
}

/**
 * Decodifica paquete de batería.
 * Layout: seq:u16BE @0, rawPct:u16BE @2, rawMv:u16BE @4
 */
export function decodeBattery(bytes: Uint8Array): BatteryReading {
  if (bytes.length < 6) {
    throw new Error(`Battery packet length ${bytes.length} < 6`);
  }

  const sequence = (bytes[0] << 8) | bytes[1];
  const rawPct = (bytes[2] << 8) | bytes[3];
  const rawMv = (bytes[4] << 8) | bytes[5];

  return {
    sequence,
    percent: Math.min(100, Math.max(0, rawPct / 512)),
    voltageMv: rawMv * 2.2,
    receivedAtMs: Date.now(),
  };
}

/**
 * Decodifica paquete de movimiento (accel o gyro).
 * Layout: seq:u16BE @0 + 9 × int16BE desde el byte 2
 * Orden: x1,y1,z1,x2,y2,z2,x3,y3,z3
 */
export function decodeMotion(bytes: Uint8Array, scale: number): MotionSample {
  if (bytes.length < 20) {
    throw new Error(`Motion packet length ${bytes.length} < 20`);
  }

  const sequence = (bytes[0] << 8) | bytes[1];
  const samples: [Vec3, Vec3, Vec3] = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];

  for (let i = 0; i < 9; i++) {
    const offset = 2 + i * 2;
    const raw = (bytes[offset] << 8 | bytes[offset + 1]) << 16 >> 16;
    const value = raw * scale;

    const sampleIdx = Math.floor(i / 3);
    const axis = i % 3;
    if (axis === 0) samples[sampleIdx].x = value;
    else if (axis === 1) samples[sampleIdx].y = value;
    else samples[sampleIdx].z = value;
  }

  return { sequence, samples, receivedAtMs: Date.now() };
}

/** Muse 2/S clásico: secuencia BE de 16 bits + 6 muestras unsigned de 24 bits. */
export function decodePpg(bytes: Uint8Array, receivedAtMs: number): PpgSample {
  if (bytes.length !== 20) {
    throw new Error(`PPG packet length ${bytes.length} != 20`);
  }
  const samples: number[] = [];
  for (let offset = 2; offset < 20; offset += 3) {
    samples.push(bytes[offset] * 65536 + bytes[offset + 1] * 256 + bytes[offset + 2]);
  }
  return { sequence: (bytes[0] << 8) | bytes[1], samples, receivedAtMs };
}

export class SequenceUnwrapper {
  private lastSeq: number | null = null;
  private wraps: number = 0;
  private anchorMs: number | null = null;
  private firstAbsIndex: number | null = null;
  private lastAbsPacket: number | null = null;

  reset(): void {
    this.lastSeq = null;
    this.wraps = 0;
    this.anchorMs = null;
    this.firstAbsIndex = null;
    this.lastAbsPacket = null;
  }

  /**
   * Desenvuelve un paquete y devuelve el índice absoluto del paquete
   * y el número de paquetes perdidos (gap).
   */
  unwrap(sequence: number, receivedAtMs: number): { absPacket: number; gap: number } {
    if (this.lastSeq === null) {
      // Primer paquete
      this.lastSeq = sequence;
      this.anchorMs = receivedAtMs;
      this.firstAbsIndex = 0;
      this.lastAbsPacket = 0;
      return { absPacket: 0, gap: 0 };
    }

    // Detectar wrap
    if (sequence < this.lastSeq - 32768) {
      this.wraps++;
    }

    const absPacket = this.wraps * 65536 + sequence;
    const gap = this.lastAbsPacket !== null ? absPacket - this.lastAbsPacket - 1 : 0;

    this.lastSeq = sequence;
    this.lastAbsPacket = absPacket;

    return { absPacket, gap };
  }

  /**
   * Calcula el timestamp absoluto para la muestra i del paquete.
   */
  getTimestampMs(absPacket: number, sampleIndex: number): number {
    if (this.anchorMs === null || this.firstAbsIndex === null) {
      return Date.now();
    }
    const sampleOffset = (absPacket - this.firstAbsIndex) * SAMPLES_PER_EEG_PACKET + sampleIndex;
    return this.anchorMs + (sampleOffset * 1000) / SAMPLE_RATE_HZ;
  }
}
