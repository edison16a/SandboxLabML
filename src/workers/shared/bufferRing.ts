/**
 * Recycles snapshot buffers between a worker and the main thread. Each frame
 * transfers one buffer away; the main thread transfers it back once it has
 * been replaced. If none is free the frame is simply dropped, so a slow tab
 * never makes the queue grow.
 */
export class BufferRing {
  private free: ArrayBuffer[] = [];
  private byteLength: number;

  constructor(floats: number, count = 3) {
    this.byteLength = floats * 4;
    for (let i = 0; i < count; i++) this.free.push(new ArrayBuffer(this.byteLength));
  }

  /** Changes the buffer size, e.g. when the number of ghosts changes. Old buffers are discarded on return. */
  resize(floats: number, count = 3): void {
    if (floats * 4 === this.byteLength) return;
    this.byteLength = floats * 4;
    this.free = [];
    for (let i = 0; i < count; i++) this.free.push(new ArrayBuffer(this.byteLength));
  }

  take(): Float32Array | null {
    const b = this.free.pop();
    return b ? new Float32Array(b) : null;
  }

  give(buffer: ArrayBuffer): void {
    if (buffer.byteLength === this.byteLength && this.free.length < 4) this.free.push(buffer);
  }
}
