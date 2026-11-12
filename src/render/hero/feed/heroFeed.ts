import type { CutClock } from '@/engine/hero/cut';
import type { Network } from '@/engine/neat/network';
import type { Genome } from '@/engine/neat/types';

/** Longest real time one frame may move a hero simulation, s. A slow frame then slows the scene down rather than piling up ticks. */
const MAX_FRAME = 0.25;
/** Most ticks one frame may run. */
const MAX_TICKS = 4;

type Listener = () => void;

/**
 * What a hero scene and its brain card read: a simulation stepped at a
 * fixed rate from the canvas's frame loop, the blend between its last two
 * ticks, how dark the cut between episodes is right now, and the brain at
 * work with its live activations. Listeners are plain arrays, so a frame
 * that tells them allocates nothing.
 */
export abstract class HeroFeed {
  /** Holds the simulation where it is, for the poster capture: the page then shows the opening tick for good. */
  frozen = false;
  /** Real time owed to the simulation, s. It starts a whole tick in, so the first frame drawn is exactly the opening tick. */
  private acc: number;
  private readonly ticks: Listener[] = [];
  private readonly episodes: Listener[] = [];

  protected constructor(readonly step: number) {
    this.acc = step;
  }

  /** Runs one tick of the simulation and publishes it. */
  protected abstract tick(): void;
  /** The cut clock of the episode on screen. */
  protected abstract clock(): CutClock;
  abstract get genome(): Genome;
  /** The network at the wheel this episode. Its values are the activations of its latest decision. */
  abstract get brain(): Network;

  /** Moves the simulation on by `dt` s of real time. */
  advance(dt: number): void {
    if (this.frozen) return;
    this.acc += Math.min(Math.max(dt, 0), MAX_FRAME);
    let n = 0;
    while (this.acc >= this.step && n < MAX_TICKS) {
      this.tick();
      this.acc -= this.step;
      n++;
    }
    if (n === MAX_TICKS) this.acc = Math.min(this.acc, this.step);
    if (n > 0) for (let i = 0; i < this.ticks.length; i++) this.ticks[i]();
  }

  /** Blend from the previous tick to the latest, 0 to 1. */
  alpha = (): number => Math.min(1, this.acc / this.step);

  /** How dark the cut is at the moment drawn, which lags the latest tick by one tick less the blend. */
  darkness(): number {
    return this.clock().darkness(this.alpha() - 1);
  }

  /** Calls `fn` after every frame that ran at least one tick. Returns the way to stop. */
  onTick(fn: Listener): () => void {
    return subscribe(this.ticks, fn);
  }

  /** Calls `fn` whenever a new episode starts (always behind a dark frame). Returns the way to stop. */
  onEpisode(fn: Listener): () => void {
    return subscribe(this.episodes, fn);
  }

  protected notifyEpisode(): void {
    for (let i = 0; i < this.episodes.length; i++) this.episodes[i]();
  }
}

function subscribe(list: Listener[], fn: Listener): () => void {
  list.push(fn);
  return () => {
    const k = list.indexOf(fn);
    if (k >= 0) list.splice(k, 1);
  };
}
