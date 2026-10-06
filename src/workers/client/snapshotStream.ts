import type { InspectPayload, StreamIn, StreamName, StreamOut } from '../shared/protocol';

interface Frame {
  buffer: Float32Array;
  tick: number;
  at: number;
}

/**
 * Main-thread end of a snapshot stream. It keeps only the previous and the
 * current frame for interpolation and hands older buffers straight back to
 * the worker, so the queue can never grow beyond two.
 */
export class SnapshotStream {
  prev: Frame | null = null;
  curr: Frame | null = null;
  count = 0;
  generation = 0;
  tags: Int32Array = new Int32Array(0);
  inspect: InspectPayload | null = null;
  rays: Float32Array | null = null;
  /** Bumped on every episode start, so renderers can rebuild per-agent state. */
  epoch = 0;
  /** Smoothed time between frames, ms. Used to pace interpolation. */
  interval = 33;
  private readonly listeners = new Set<(msg: StreamOut) => void>();

  constructor(
    readonly name: StreamName,
    private readonly port: MessagePort,
  ) {
    port.onmessage = (e: MessageEvent<StreamOut>) => this.receive(e.data);
  }

  private receive(msg: StreamOut): void {
    if (msg.stream !== this.name) return;
    if (msg.kind === 'start') {
      this.count = msg.count;
      this.generation = msg.generation;
      this.tags = msg.tags ?? new Int32Array(msg.count);
      this.epoch++;
      this.release(this.prev);
      this.release(this.curr);
      this.prev = this.curr = null;
    } else if (msg.kind === 'frame') {
      const now = performance.now();
      if (this.curr) this.interval = this.interval * 0.85 + Math.min(250, now - this.curr.at) * 0.15;
      this.release(this.prev);
      this.prev = this.curr;
      this.curr = { buffer: msg.buffer, tick: msg.tick, at: now };
      this.count = msg.count;
      if (msg.inspect) this.inspect = msg.inspect;
      if (msg.rays) this.rays = msg.rays;
    }
    for (const fn of this.listeners) fn(msg);
  }

  private release(frame: Frame | null): void {
    if (!frame) return;
    const buffer = frame.buffer.buffer as ArrayBuffer;
    this.port.postMessage({ kind: 'return', buffer } satisfies StreamIn, [buffer]);
  }

  /** How far to blend from prev to curr at time `now`, in [0, 1]. */
  alpha(now = performance.now()): number {
    if (!this.curr || !this.prev) return 1;
    return Math.min(1, Math.max(0, (now - this.curr.at) / this.interval));
  }

  subscribe(inspect: number | null, rays: boolean): void {
    this.port.postMessage({ kind: 'subscribe', stream: this.name, inspect, rays } satisfies StreamIn);
  }

  on(fn: (msg: StreamOut) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  clear(): void {
    this.release(this.prev);
    this.release(this.curr);
    this.prev = this.curr = null;
    this.count = 0;
    this.epoch++;
  }
}
