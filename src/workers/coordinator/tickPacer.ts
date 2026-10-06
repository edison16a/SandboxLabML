/** Frames per second the live grid is fed at. Matches the 30 Hz physics, so 1x sends one tick per frame. */
const FRAME_HZ = 30;
/** Ticks per slice when running flat out: one second of play between barriers keeps them cheap. */
const FLAT_OUT_TICKS = 30;

/**
 * Paces an asynchronous tick function at a multiple of real time. It is
 * the coordinator's side of the tick barrier: each slice works out how many
 * 30 Hz ticks are due, asks every sim worker to run them, and waits for all
 * of them before scheduling the next slice, so no worker runs ahead.
 * An infinite speed runs flat out, still in slices, so frames keep flowing.
 */
export class TickPacer {
  private speed: number;
  private paused = false;
  private stopped = false;
  private last = 0;
  private debt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    speed: number,
    private readonly tickHz: number,
    /** Runs `n` ticks everywhere; resolves false once the episode is over. */
    private readonly runTicks: (n: number) => Promise<boolean>,
    private readonly onDone: () => void,
    private readonly onError: (err: unknown) => void,
  ) {
    this.speed = speed;
  }

  start(): void {
    this.last = performance.now();
    this.schedule(0);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.last = performance.now();
    this.debt = 0;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.last = performance.now();
    this.debt = 0;
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(ms: number): void {
    if (!this.stopped) this.timer = setTimeout(() => void this.slice(), ms);
  }

  private async slice(): Promise<void> {
    if (this.stopped) return;
    const now = performance.now();
    const elapsed = (now - this.last) / 1000;
    this.last = now;
    if (this.paused) return this.schedule(50);
    let n: number;
    if (!Number.isFinite(this.speed)) {
      n = FLAT_OUT_TICKS;
    } else {
      this.debt += elapsed * this.tickHz * this.speed;
      // Never catch up more than a quarter second at once, so a stall does not turn into a burst.
      n = Math.min(Math.floor(this.debt), Math.ceil(this.tickHz * this.speed * 0.25));
      this.debt -= n;
    }
    let running = true;
    try {
      if (n > 0) running = await this.runTicks(n);
    } catch (err) {
      this.stopped = true;
      this.onError(err);
      return;
    }
    if (this.stopped) return;
    if (!running) {
      this.stopped = true;
      this.onDone();
      return;
    }
    this.schedule(Number.isFinite(this.speed) ? 1000 / FRAME_HZ : 0);
  }
}
