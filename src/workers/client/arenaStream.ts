import type { InspectPayload, StreamIn, StreamName, StreamOut } from '../shared/protocol';
import type { ArenaFeed, ArenaFrame } from './arenaFeed';
import { ArenaMerger } from './arenaMerge';

/**
 * Main-thread end of a stream that several workers fill together. Each
 * worker's slice is merged into place and its buffer goes straight back,
 * so the workers never run out. Complete ticks are published as prev and
 * curr frames, exactly like a single-worker SnapshotStream.
 */
export class ArenaStream implements ArenaFeed {
  prev: ArenaFrame | null = null;
  curr: ArenaFrame | null = null;
  count = 0;
  generation = 0;
  tags = new Int32Array(0);
  inspect: InspectPayload | null = null;
  rays: Float32Array | null = null;
  epoch = 0;
  /** Smoothed time between complete frames, ms. Paces interpolation. */
  interval = 33;
  private readonly merger = new ArenaMerger();
  private spare: Float32Array[] = [];
  private readonly listeners = new Set<(msg: StreamOut) => void>();

  constructor(
    readonly name: StreamName,
    private readonly ports: MessagePort[],
  ) {
    for (const port of ports) port.onmessage = (e: MessageEvent<StreamOut>) => this.receive(port, e.data);
  }

  private receive(port: MessagePort, msg: StreamOut): void {
    if (msg.stream !== this.name) return;
    if (msg.kind === 'start' && msg.part) {
      if (this.merger.start(msg.part, msg.count, msg.tags)) {
        this.epoch++;
        this.prev = this.curr = null;
        this.spare = [];
        this.inspect = null;
        this.count = msg.part.total;
        this.generation = msg.generation;
      }
      this.tags = this.merger.tags;
    } else if (msg.kind === 'frame') {
      const tick = msg.part ? this.merger.frame(msg.part, msg.count, msg.tick, msg.buffer, msg.rays) : -1;
      if (msg.inspect) this.inspect = msg.inspect;
      const buffer = msg.buffer.buffer as ArrayBuffer;
      port.postMessage({ kind: 'return', buffer } satisfies StreamIn, [buffer]);
      if (tick >= 0) this.publish(tick);
    }
    for (const fn of this.listeners) fn(msg);
  }

  private publish(tick: number): void {
    const src = this.merger.buffer;
    let buffer = this.spare.pop();
    if (!buffer || buffer.length !== src.length) buffer = new Float32Array(src.length);
    buffer.set(src);
    const now = performance.now();
    if (this.curr) this.interval = this.interval * 0.85 + Math.min(250, now - this.curr.at) * 0.15;
    if (this.prev) this.spare.push(this.prev.buffer);
    this.prev = this.curr;
    this.curr = { buffer, tick, at: now };
    const rays = this.merger.raysComplete ? this.merger.rays : null;
    if (rays) {
      if (!this.rays || this.rays.length !== rays.length) this.rays = new Float32Array(rays.length);
      this.rays.set(rays);
    } else this.rays = null;
  }

  /** How far to blend from prev to curr at time `now`, in [0, 1]. */
  alpha(now = performance.now()): number {
    if (!this.curr || !this.prev) return 1;
    return Math.min(1, Math.max(0, (now - this.curr.at) / this.interval));
  }

  /** Every worker gets the same request; only the one owning the inspected arena answers it. */
  subscribe(inspect: number | null, rays: boolean): void {
    for (const port of this.ports) port.postMessage({ kind: 'subscribe', stream: this.name, inspect, rays } satisfies StreamIn);
  }

  on(fn: (msg: StreamOut) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Forgets the current frames, e.g. when another run is opened. */
  clear(): void {
    this.prev = this.curr = null;
    this.count = 0;
    this.inspect = null;
    this.rays = null;
    this.epoch++;
  }
}
