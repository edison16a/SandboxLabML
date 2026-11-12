/**
 * The calm cut between two hero episodes, in ticks at 30 Hz: the frame
 * holds a moment after the agent arrives, dips to the page color, stays
 * dark while the next episode is put in place, and comes back up while
 * the agent sets off.
 */
export const CUT = { hold: 50, fadeOut: 24, dark: 8, fadeIn: 30 } as const;

export type CutTiming = { readonly [K in keyof typeof CUT]: number };

/** A smooth 0 to 1 ramp: eases in and out, so a dip never starts or ends with a jolt. */
const ease = (u: number) => {
  const t = Math.min(1, Math.max(0, u));
  return t * t * (3 - 2 * t);
};

/**
 * Keeps time within one hero episode and says when it is over and how dark
 * the frame is. Pure bookkeeping on whole ticks, so the page, the tests and
 * the scripts agree on every tick of the loop.
 */
export class CutClock {
  /** Ticks since the episode started. */
  tick = 0;
  /** The tick the agent stopped on, or -1 while it is still going. */
  stoppedAt = -1;

  constructor(private readonly cut: CutTiming = CUT) {}

  /** Starts an episode in the dark, or already fully shown when the page opens on it. */
  start(shown: boolean): void {
    this.tick = shown ? this.cut.dark + this.cut.fadeIn : 0;
    this.stoppedAt = -1;
  }

  /**
   * Counts one tick. `stopped` says whether the agent has stopped by now.
   * Returns true once the next episode should start: two ticks after the
   * dip is fully dark, since the page draws up to a tick behind the latest.
   */
  step(stopped: boolean): boolean {
    this.tick++;
    if (stopped && this.stoppedAt < 0) this.stoppedAt = this.tick;
    return this.stoppedAt >= 0 && this.tick - this.stoppedAt >= this.cut.hold + this.cut.fadeOut + 2;
  }

  /**
   * How dark the frame is, 0 to 1, at `ahead` ticks past the current one
   * (the page passes its blend between ticks, so the dip moves every frame
   * rather than every tick).
   */
  darkness(ahead = 0): number {
    const { hold, fadeOut, dark, fadeIn } = this.cut;
    const t = this.tick + ahead;
    if (this.stoppedAt >= 0) {
      const after = t - this.stoppedAt - hold;
      if (after > 0) return ease(after / fadeOut);
    }
    return 1 - ease((t - dark) / fadeIn);
  }

  /** True while the frame is fully dark, when it is safe to swap what is on screen. */
  get dark(): boolean {
    return this.darkness() >= 1;
  }
}
