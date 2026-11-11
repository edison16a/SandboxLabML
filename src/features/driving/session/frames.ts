import { tripOf, tripsOf } from '@/engine/driving/run/tripHeader';
import { DRIVING_SNAPSHOT } from '@/engine/driving/snapshotLayout';
import type { FrameBuffer, FrameSource } from '@/render/driving/frame/source';
import type { SnapshotStream } from '@/workers/client/snapshotStream';

const STRIDE = DRIVING_SNAPSHOT.stride;
/** Trips a generation can hold, so every trip of an episode gets its own epoch. */
const EPOCH_TRIPS = 8;

/**
 * A worker stream as the city renderer reads it. Each frame holds every
 * SUV and then the world block, so the world source is this same object
 * with an offset. When a generation moves to its next trip, everyone jumps
 * to a new start: that counts as a new episode (a new epoch, nothing to
 * blend from), so the camera cuts instead of gliding across town.
 *
 * Set `match` and the source goes dark while the other one shows another
 * trip: past champions drawn over the population only appear on the trip
 * the population is driving.
 */
export class StreamFrames implements FrameSource {
  match: StreamFrames | null = null;

  constructor(readonly stream: SnapshotStream) {}

  private hidden(): boolean {
    return this.match !== null && this.match.stream.curr !== null && this.trip() !== this.match.trip();
  }

  get count(): number {
    return this.hidden() ? 0 : this.stream.count;
  }

  get tags(): Int32Array {
    return this.stream.tags;
  }

  get worldOffset(): number {
    return this.stream.count * STRIDE;
  }

  get curr(): FrameBuffer | null {
    return this.hidden() ? null : this.stream.curr;
  }

  /** Nothing to blend from across a trip change. */
  get prev(): FrameBuffer | null {
    const { prev, curr } = this.stream;
    if (!prev || !curr || this.hidden()) return null;
    return tripOf(prev.buffer, this.worldOffset) === tripOf(curr.buffer, this.worldOffset) ? prev : null;
  }

  get epoch(): number {
    return this.stream.epoch * EPOCH_TRIPS + this.trip();
  }

  alpha(now?: number): number {
    return this.stream.alpha(now);
  }

  /** The trip the latest frame shows. */
  trip(): number {
    const curr = this.stream.curr;
    return curr && this.stream.world > 0 ? tripOf(curr.buffer, this.worldOffset) : 0;
  }

  /** How many trips the episode on screen drives. */
  trips(): number {
    const curr = this.stream.curr;
    return curr && this.stream.world > 0 ? tripsOf(curr.buffer, this.worldOffset) : 1;
  }
}
