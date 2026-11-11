import { BLUEPRINT_SCHEMA_VERSION, type Blueprint } from '../../blueprints/types';
import { hashObject } from '../../core/hash';
import type { Network } from '../../neat/network';
import type { ChampionRecord } from '../../training/records';
import { envSettings } from '../../training/runConfig';
import type { EpisodeEnv, EpisodeEnvModule, EpisodeResult, EpisodeSetup } from '../episode';
import type { EnvId } from '../types';

/**
 * A toy env that only the tests register: every agent walks along a line
 * toward a goal 10 m away, and a beacon swings back and forth as shared
 * world state. It is small on purpose, so the tests can drive the whole
 * generic pipeline (trainer, sim, ghosts, storage) with an env that is
 * not Racing and check every seam of the contract.
 */
export const TOY_ENV = 'toy' as EnvId;
const GOAL = 10;
const DT = 1 / 30;

export interface ToySetup extends EpisodeSetup {
  goal: number;
  maxTime: number;
}

export interface ToyResult extends EpisodeResult {
  reached: boolean;
}

interface Walker {
  x: number;
  best: number;
  out: Float64Array;
  obs: Float64Array;
  running: boolean;
  time: number;
  stop: string | null;
}

class ToyEnv implements EpisodeEnv<ToyResult> {
  readonly worldFloats = 2;
  readonly raysPerAgent = 1;
  tick = 0;
  private walkers: Walker[] = [];
  private brains: Network[] = [];

  constructor(private readonly setup: ToySetup) {}

  get agentCount(): number {
    return this.walkers.length;
  }

  get done(): boolean {
    return this.walkers.every((w) => !w.running);
  }

  reset(brains: Network[], _seeds: number[] = [], slots: number[] = []): void {
    this.brains = brains;
    this.walkers = brains.map((_, i) => ({ x: -(slots[i] ?? 0), best: 0, out: new Float64Array(1), obs: new Float64Array(2), running: true, time: 0, stop: null }));
    this.tick = 0;
  }

  step(): void {
    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i];
      if (!w.running) continue;
      w.obs[0] = (this.setup.goal - w.x) / this.setup.goal;
      w.obs[1] = 1;
      this.brains[i].activate(w.obs, w.out);
      w.x += w.out[0] * 3 * DT;
      w.best = Math.max(w.best, w.x);
      w.time += DT;
      if (w.x >= this.setup.goal) w.stop = 'reached';
      else if (w.time >= this.setup.maxTime - 1e-9) w.stop = 'time';
      if (w.stop) w.running = false;
    }
    this.tick++;
  }

  writeSnapshot(out: Float32Array, offset = 0): void {
    this.walkers.forEach((w, i) => {
      out[offset + i * 2] = w.x;
      out[offset + i * 2 + 1] = w.running ? 0 : 1;
    });
  }

  writeWorld(out: Float32Array, offset: number): void {
    out[offset] = Math.sin(this.tick * DT);
    out[offset + 1] = this.tick;
  }

  leaderIndex(): number {
    let best = 0;
    this.walkers.forEach((w, i) => {
      if (w.x > this.walkers[best].x) best = i;
    });
    return best;
  }

  results(): ToyResult[] {
    return this.walkers.map((w) => ({ fitness: w.best, time: w.time, stopReason: w.stop, reached: w.stop === 'reached' }));
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

export const TOY_BLUEPRINT = {
  id: 'toy-basic',
  name: 'Toy',
  env: TOY_ENV,
  tier: 'starter',
  description: 'Distance to the goal and a constant.',
  teaches: 'Nothing; it is a test fixture.',
  schemaVersion: BLUEPRINT_SCHEMA_VERSION,
  readonly: true,
  activation: 'tanh',
  wiring: 'direct',
  inputs: { noise: 0 },
} as unknown as Blueprint;

export const toyModule: EpisodeEnvModule<ToySetup, { level: number }, ToyResult, ChampionRecord> = {
  id: TOY_ENV,
  label: 'Toy',
  engineVersion: 7,
  tickHz: 30,
  snapshot: { stride: 2, fields: ['x', 'stopped'] },
  outputs: [{ index: 0, key: 'move', label: 'Move' }],
  metrics: [
    { key: 'reachedShare', label: 'Reached', unit: '%', source: 'generation', better: 'higher', format: (v) => `${Math.round(v * 100)}%` },
    { key: 'best', label: 'Best', unit: 'm', source: 'champion', better: 'higher', format: (v) => `${v.toFixed(1)} m` },
  ],
  blueprints: [TOY_BLUEPRINT],
  inputCount: () => 2,
  inputSchema: () => [
    { index: 0, key: 'goal', label: 'Goal', group: 'scalar', unit: 'm', scale: GOAL, offset: 0 },
    { index: 1, key: 'one', label: 'One', group: 'scalar', unit: '', scale: 1, offset: 0 },
  ],
  physicsHash: (config) => hashObject({ toy: 1, inputs: config.blueprint.inputs }),
  initialContent: () => ({ level: 1 }),
  // The curriculum: a level up once half the population reaches the goal.
  nextContent: ({ content, metrics }) => ((metrics.reachedShare ?? 0) >= 0.5 ? { content: { level: content.level + 1 }, reset: true } : null),
  contentHash: (c) => `level-${c.level}`,
  createSetup: ({ config, content, scriptSource }) => ({ goal: GOAL * content.level, maxTime: envSettings<{ maxTime: number }>(config).maxTime, scriptSource }),
  createEnv: (setup) => new ToyEnv(setup),
  championFields: (r) => ({ metrics: { best: r.fitness } }),
  bench: {
    version: 1,
    axes: [{ key: 'reach', label: 'Reach' }],
    hint: 'a longer line, 0 to 100',
    about: 'Never runs in the tests.',
    run: async () => null,
  },
  generationMetrics: (results) => ({ reachedShare: results.filter((r) => r.reached).length / results.length }),
  load: async () => toyModule,
  telemetry: {
    sample: (env, i, out) => {
      const snap = new Float32Array(env.agentCount * 2);
      env.writeSnapshot(snap);
      out[0] = snap[i * 2];
      out[1] = 0;
      out[2] = 0;
    },
    crash: () => null,
  },
};
