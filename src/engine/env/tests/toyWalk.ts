import { makeTickIO, type AgentController } from '../types';
import type { Network } from '../../neat/network';
import type { EpisodeEnv, EpisodeResult, EpisodeSetup } from '../episode';

export const TOY_DT = 1 / 30;
/** Meters per second at full output. */
const PACE = 3;

export interface ToySetup extends EpisodeSetup {
  goal: number;
  maxTime: number;
}

export interface ToyResult extends EpisodeResult {
  reached: boolean;
  /** Where the walker stopped, m. */
  x: number;
}

/** One walker, and the view a script's tick block reads. */
export interface ToyWalker {
  x: number;
  best: number;
  /** Ground gained beyond the best so far by the latest step, m. */
  gain: number;
  goal: number;
  seed: number;
  out: Float64Array;
  obs: Float64Array;
  running: boolean;
  time: number;
  fitness: number;
  stop: string | null;
}

/** The built in reward: new ground gained toward the goal, and a stop once there. */
export const toyBuiltin: AgentController<ToyWalker> = {
  customSensorCount: 0,
  sensors: () => {},
  tick: (w, io) => {
    io.action[0] = io.brain[0];
    io.reward = w.gain;
    if (w.x >= w.goal) io.stop = 'reached';
  },
};

/**
 * Every walker walks along a line toward its goal, and a beacon swings
 * back and forth as shared world state. The controller (the built in
 * reward or a compiled script) turns brain outputs into a pace, a reward
 * and a stop, the way Racing's controller turns them into a drive.
 */
export class ToyEnv implements EpisodeEnv<ToyResult> {
  readonly worldFloats = 2;
  readonly raysPerAgent = 1;
  tick = 0;
  private walkers: ToyWalker[] = [];
  private brains: Network[] = [];
  private readonly io = makeTickIO(1, 1);

  constructor(
    private readonly setup: ToySetup,
    private readonly controller: AgentController<ToyWalker>,
  ) {}

  /** Where the walkers are headed, m. The preview hook reads it. */
  get goal(): number {
    return this.setup.goal;
  }

  get agentCount(): number {
    return this.walkers.length;
  }

  get done(): boolean {
    return this.walkers.every((w) => !w.running);
  }

  reset(brains: Network[], seeds: number[] = [], slots: number[] = []): void {
    this.brains = brains;
    const inputs = 2 + this.controller.customSensorCount;
    this.walkers = brains.map((_, i) => ({ x: -(slots[i] ?? 0), best: 0, gain: 0, goal: this.setup.goal, seed: seeds[i] ?? 0, out: new Float64Array(1), obs: new Float64Array(inputs), running: true, time: 0, fitness: 0, stop: null }));
    this.tick = 0;
  }

  step(): void {
    const io = this.io;
    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i];
      if (!w.running) continue;
      w.obs[0] = (w.goal - w.x) / w.goal;
      w.obs[1] = 1;
      if (this.controller.customSensorCount > 0) this.controller.sensors(w, w.obs, 2);
      this.brains[i].activate(w.obs, w.out);
      io.brain[0] = w.out[0];
      io.action[0] = 0;
      io.reward = 0;
      io.stop = null;
      this.controller.tick(w, io);
      w.x += io.action[0] * PACE * TOY_DT;
      w.gain = Math.max(0, w.x - w.best);
      w.best += w.gain;
      w.fitness += io.reward;
      w.time += TOY_DT;
      w.stop = io.stop ?? (w.time >= this.setup.maxTime - 1e-9 ? 'time' : null);
      if (w.stop) w.running = false;
    }
    this.tick++;
  }

  writeSnapshot(out: Float32Array, offset = 0): void {
    for (let i = 0; i < this.walkers.length; i++) {
      out[offset + i * 2] = this.walkers[i].x;
      out[offset + i * 2 + 1] = this.walkers[i].running ? 0 : 1;
    }
  }

  writeWorld(out: Float32Array, offset: number): void {
    out[offset] = Math.sin(this.tick * TOY_DT);
    out[offset + 1] = this.tick;
  }

  leaderIndex(): number {
    let best = 0;
    for (let i = 1; i < this.walkers.length; i++) if (this.walkers[i].x > this.walkers[best].x) best = i;
    return best;
  }

  results(): ToyResult[] {
    return this.walkers.map((w) => ({ fitness: w.fitness, time: w.time, stopReason: w.stop, reached: w.x >= w.goal, x: w.x }));
  }

  lastObservation(i: number): Float64Array {
    return this.walkers[i].obs;
  }

  writeOutputs(i: number, out: Float32Array): void {
    out[0] = this.walkers[i].out[0];
  }

  writeRays(i: number, out: Float32Array, offset: number): void {
    out[offset] = this.walkers[i].obs[0];
  }
}
