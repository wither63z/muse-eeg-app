import { RingBuffer } from '@/dsp/ringBuffer';

describe('RingBuffer', () => {
  it('handles wrap-around correctly', () => {
    const buf = new RingBuffer(4);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4);
    buf.push(5); // Sobrescribe 1
    buf.push(6); // Sobrescribe 2

    expect(buf.count).toBe(4);

    const out = new Float32Array(4);
    const n = buf.copyTo(out);
    expect(n).toBe(4);
    expect(Array.from(out)).toEqual([3, 4, 5, 6]);
  });

  it('returns chronological order', () => {
    const buf = new RingBuffer(3);
    buf.push(10);
    buf.push(20);
    buf.push(30);

    const out = new Float32Array(3);
    buf.copyTo(out);
    expect(Array.from(out)).toEqual([10, 20, 30]);
  });

  it('count is min(total pushed, capacity)', () => {
    const buf = new RingBuffer(5);
    expect(buf.count).toBe(0);
    buf.push(1);
    buf.push(2);
    expect(buf.count).toBe(2);
    for (let i = 0; i < 10; i++) buf.push(i);
    expect(buf.count).toBe(5);
  });

  it('copyLast returns last n samples', () => {
    const buf = new RingBuffer(5);
    for (let i = 1; i <= 5; i++) buf.push(i);

    const out = new Float32Array(3);
    const n = buf.copyLast(3, out);
    expect(n).toBe(3);
    expect(Array.from(out)).toEqual([3, 4, 5]);
  });

  it('clear resets the buffer', () => {
    const buf = new RingBuffer(3);
    buf.push(1);
    buf.push(2);
    buf.clear();
    expect(buf.count).toBe(0);
  });
});
