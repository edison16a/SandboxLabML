/**
 * Runs a simulation at a multiple of real time from inside a worker. Each
 * slice works out how many 30 Hz ticks are due since the last one and runs
 * them, so the rate stays right even when slices arrive late. An infinite
 * speed runs flat out in short slices that still yield to messages.
 */
export class Pacer {
  private speed: number;
  private paused = false;
  private last = 0;
  private debt = 0;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    speed: number,
    private readonly tickHz: number,
    /** Runs up to `n` ticks; returns false when the episode is over. */
    private readonly runTicks: (n: number) => boolean,
    private readonly onSlice: () => void,
    private readonly onDone: () => void,
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
    if (!this.stopped) this.timer = setTimeout(() => this.slice(), ms);
  }

  private slice(): void {
    if (this.stopped) return;
    const now = performance.now();
    const elapsed = (now - this.last) / 1000;
    this.last = now;
    if (this.paused) return this.schedule(50);
    let n: number;
    if (!Number.isFinite(this.speed)) {
      n = 240;
    } else {
      this.debt += elapsed * this.tickHz * this.speed;
      n = Math.min(Math.floor(this.debt), Math.ceil(this.tickHz * this.speed * 0.25));
      this.debt -= n;
    }
    const running = n > 0 ? this.runTicks(n) : true;
    if (n > 0) this.onSlice();
    if (!running) {
      this.stopped = true;
      this.onDone();
      return;
    }
    this.schedule(Number.isFinite(this.speed) ? 1000 / 60 : 0);
  }
}
