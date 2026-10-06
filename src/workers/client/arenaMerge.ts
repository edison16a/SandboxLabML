import { HIDESEEK_RAY_SNAPSHOT, HIDESEEK_SNAPSHOT } from '@/engine/hideseek/snapshot';
import type { StreamPart } from '../shared/protocol';

const STRIDE = HIDESEEK_SNAPSHOT.stride;
const RAY_STRIDE = HIDESEEK_RAY_SNAPSHOT.stride;

interface PartState {
  count: number;
  /** Tick of the latest frame copied in, -1 before the first. */
  tick: number;
  rays: boolean;
}

/**
 * Assembles one arena stream from slices sent by several workers. Each
 * slice is copied into place by its first index as it arrives, and a tick
 * counts as complete once every slice of the episode has reached it and
 * the slices cover every arena. Workers step on a shared barrier, so in
 * practice each tick completes as soon as its last slice lands; if a worker
 * drops a frame, the next tick simply completes instead.
 */
export class ArenaMerger {
  epoch = -1;
  total = 0;
  tags = new Int32Array(0);
  /** Every arena, assembled in match order. Overwritten in place as slices arrive. */
  buffer = new Float32Array(0);
  /** Ray hit points for every arena, valid when the last complete tick had rays from every slice. */
  rays: Float32Array | null = null;
  raysComplete = false;
  private readonly parts = new Map<number, PartState>();

  /** Registers a slice. Returns true when it opened a new episode, which drops everything from the last one. */
  start(part: StreamPart, count: number, tags?: Int32Array): boolean {
    let fresh = false;
    if (part.epoch !== this.epoch) {
      this.epoch = part.epoch;
      this.total = part.total;
      this.parts.clear();
      this.buffer = new Float32Array(part.total * STRIDE);
      this.tags = new Int32Array(part.total);
      this.rays = null;
      fresh = true;
    }
    this.parts.set(part.first, { count, tick: -1, rays: false });
    if (tags) this.tags.set(tags.subarray(0, Math.min(count, this.total - part.first)), part.first);
    return fresh;
  }

  /** Copies one slice in. Returns the tick this completed, or -1 while slices are still missing. */
  frame(part: StreamPart, count: number, tick: number, buffer: Float32Array, rays?: Float32Array): number {
    const p = part.epoch === this.epoch ? this.parts.get(part.first) : undefined;
    if (!p) return -1;
    const n = Math.min(count, p.count, this.total - part.first);
    this.buffer.set(buffer.subarray(0, n * STRIDE), part.first * STRIDE);
    p.rays = !!rays;
    if (rays) {
      if (!this.rays) this.rays = new Float32Array(this.total * RAY_STRIDE);
      this.rays.set(rays.subarray(0, n * RAY_STRIDE), part.first * RAY_STRIDE);
    }
    p.tick = tick;
    let covered = 0;
    let allRays = true;
    for (const q of this.parts.values()) {
      if (q.tick !== tick) return -1;
      covered += q.count;
      allRays &&= q.rays;
    }
    if (covered < this.total) return -1;
    this.raysComplete = allRays;
    return tick;
  }
}
