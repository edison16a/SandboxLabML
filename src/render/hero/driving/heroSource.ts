import type { FrameBuffer, FrameSource } from '@/render/driving/frame/source';

/**
 * A frame source the hero fills by hand, the shape the city renderer reads
 * from a worker stream: the last two snapshots and an epoch that changes
 * when a trip starts. Its two buffers take turns, so a tick allocates
 * nothing, and its blend comes from the feed's own clock.
 */
export class HeroSource implements FrameSource {
  prev: FrameBuffer | null = null;
  curr: FrameBuffer | null = null;
  readonly tags: Int32Array;
  epoch = 0;
  private readonly frames: [FrameBuffer, FrameBuffer];

  constructor(
    size: number,
    readonly count: number,
    private readonly blend: () => number,
  ) {
    // One agent with tag 0: the followed SUV wears the first paint, the app's own blue.
    this.tags = new Int32Array(count);
    this.frames = [
      { buffer: new Float32Array(size), tick: -1, at: 0 },
      { buffer: new Float32Array(size), tick: -1, at: 0 },
    ];
  }

  /** The buffer to write the next tick into: whichever one is not the latest. */
  next(): Float32Array {
    return this.spare().buffer;
  }

  /** Makes the buffer just written the latest, at `tick`. */
  push(tick: number): void {
    const frame = this.spare();
    frame.tick = tick;
    this.prev = this.curr;
    this.curr = frame;
  }

  /** Forgets both frames and starts a new epoch, for a new trip. */
  restart(): void {
    this.prev = this.curr = null;
    this.epoch++;
  }

  alpha(): number {
    return this.blend();
  }

  private spare(): FrameBuffer {
    return this.curr === this.frames[0] ? this.frames[1] : this.frames[0];
  }
}
