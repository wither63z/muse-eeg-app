/**
 * RingBuffer — búfer circular O(1) sin asignaciones de memoria.
 * Almacena números en un Float32Array fijo. push es O(1).
 */
export class RingBuffer {
  private buffer: Float32Array;
  private head: number = 0;
  private size: number = 0;

  constructor(readonly capacity: number) {
    this.buffer = new Float32Array(capacity);
  }

  push(value: number): void {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
  }

  pushMany(values: ArrayLike<number>): void {
    for (let i = 0; i < values.length; i++) {
      this.push(values[i]);
    }
  }

  get count(): number {
    return this.size;
  }

  /**
   * Copia en orden cronológico (más antiguo → más nuevo) a `out`.
   * Devuelve el número de muestras copiadas.
   */
  copyTo(out: Float32Array): number {
    const n = Math.min(this.size, out.length);
    if (n === 0) return 0;

    const start = (this.head - this.size + this.capacity) % this.capacity;
    for (let i = 0; i < n; i++) {
      out[i] = this.buffer[(start + i) % this.capacity];
    }
    return n;
  }

  /**
   * Últimas n muestras en orden cronológico.
   */
  copyLast(n: number, out: Float32Array): number {
    const count = Math.min(n, this.size, out.length);
    if (count === 0) return 0;

    const start = (this.head - count + this.capacity) % this.capacity;
    for (let i = 0; i < count; i++) {
      out[i] = this.buffer[(start + i) % this.capacity];
    }
    return count;
  }

  clear(): void {
    this.head = 0;
    this.size = 0;
  }
}
