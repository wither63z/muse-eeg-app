import { decodeEegPacket, decodeBattery, decodeMotion, base64ToBytes, SequenceUnwrapper } from '@/ble/museDecoder';
import { encodeCommand } from '@/ble/museCommands';
import { fromByteArray, toByteArray } from 'base64-js';
import { EegChannel } from '@/types/muse';

describe('museDecoder', () => {
  describe('decodeEegPacket', () => {
    it('decodes 12-bit samples correctly (even/odd parity)', () => {
      const raw = [0, 2048, 4095, 1, 2047, 2049, 100, 200, 300, 400, 500, 600];
      const bytes = new Uint8Array(20);
      bytes[0] = 0;
      bytes[1] = 1;

      for (let i = 0; i < 12; i++) {
        const k = 2 + ((i * 12) >> 3);
        if (i % 2 === 0) {
          bytes[k] = (raw[i] >> 4) & 0xff;
          bytes[k + 1] = (raw[i] & 0x0f) << 4;
        } else {
          bytes[k] |= (raw[i] >> 8) & 0x0f;
          bytes[k + 1] = raw[i] & 0xff;
        }
      }

      const packet = decodeEegPacket('TP9' as EegChannel, bytes, Date.now());

      expect(packet.sequence).toBe(1);
      expect(packet.samplesUv.length).toBe(12);

      for (let i = 0; i < 12; i++) {
        const expected = (raw[i] - 2048) * 0.48828125;
        expect(packet.samplesUv[i]).toBeCloseTo(expected, 5);
      }
    });

    it('throws error if packet length is not 20', () => {
      expect(() => decodeEegPacket('TP9' as EegChannel, new Uint8Array(19), Date.now())).toThrow('EEG packet length 19 != 20');
      expect(() => decodeEegPacket('TP9' as EegChannel, new Uint8Array(21), Date.now())).toThrow('EEG packet length 21 != 20');
    });
  });

  describe('decodeBattery', () => {
    it('decodes battery reading correctly', () => {
      // seq=1, rawPct=256 (0x0100), rawMv=500 (0x01F4)
      const bytes = new Uint8Array([0, 1, 1, 0, 1, 244]);
      const reading = decodeBattery(bytes);

      expect(reading.sequence).toBe(1);
      expect(reading.percent).toBeCloseTo(256 / 512, 5);
      expect(reading.voltageMv).toBeCloseTo(500 * 2.2, 5);
    });

    it('clamps percent to 0-100', () => {
      // rawPct=60000 (0xEA60) → 117% → clamp a 100
      const bytes = new Uint8Array([0, 1, 234, 96, 1, 244]);
      const reading = decodeBattery(bytes);
      expect(reading.percent).toBe(100);
    });
  });

  describe('decodeMotion', () => {
    it('decodes motion with negative int16 values', () => {
      const bytes = new Uint8Array(20);
      bytes[0] = 0; bytes[1] = 1;
      bytes[2] = 0xff; bytes[3] = 0xff; // x1 = -1

      const packet = decodeMotion(bytes, 0.0000610352);
      expect(packet.sequence).toBe(1);
      expect(packet.samples[0].x).toBeCloseTo(-1 * 0.0000610352, 10);
    });
  });

  describe('base64ToBytes', () => {
    it('converts base64 to bytes correctly', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const b64 = fromByteArray(original);
      const decoded = base64ToBytes(b64);
      expect(decoded).toEqual(original);
    });
  });
});

describe('museCommands', () => {
  describe('encodeCommand', () => {
    it('encodes p21 correctly', () => {
      const encoded = encodeCommand('p21');
      const bytes = toByteArray(encoded);
      expect(bytes).toEqual(new Uint8Array([4, 0x70, 0x32, 0x31, 0x0a]));
    });

    it('encodes h correctly', () => {
      const encoded = encodeCommand('h');
      const bytes = toByteArray(encoded);
      expect(bytes).toEqual(new Uint8Array([2, 0x68, 0x0a]));
    });
  });
});

describe('SequenceUnwrapper', () => {
  it('detects sequence wrap', () => {
    const unwrapper = new SequenceUnwrapper();
    const now = Date.now();

    unwrapper.unwrap(65534, now);
    unwrapper.unwrap(65535, now);
    const result = unwrapper.unwrap(0, now);

    expect(result.absPacket).toBe(65536);
  });

  it('calculates monotonic timestamps', () => {
    const unwrapper = new SequenceUnwrapper();
    const now = Date.now();

    unwrapper.unwrap(0, now);
    const result = unwrapper.unwrap(1, now);

    const t0 = unwrapper.getTimestampMs(0, 0);
    const t1 = unwrapper.getTimestampMs(1, 0);
    expect(t1).toBeGreaterThan(t0);
  });

  it('reports gap for missing packets', () => {
    const unwrapper = new SequenceUnwrapper();
    const now = Date.now();

    unwrapper.unwrap(0, now);
    const result = unwrapper.unwrap(3, now);

    expect(result.gap).toBe(2);
  });

  it('resets on large gap (reconnection)', () => {
    const unwrapper = new SequenceUnwrapper();
    const now = Date.now();

    unwrapper.unwrap(0, now);
    const result = unwrapper.unwrap(100, now);

    expect(result.gap).toBe(99);
    const after = unwrapper.unwrap(101, now);
    expect(after.absPacket).toBe(101);
  });
});
