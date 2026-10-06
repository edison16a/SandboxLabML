import { Rng } from '../core/rng';
import { makeTickIO, type AgentController, type InputSpec, type SnapshotLayout } from '../env/types';
import type { Network } from '../neat/network';
import { stepCar } from './car/dynamics';
import type { CarParams } from './car/params';
import { createRacingCar, stopCar, updateTrackState, STATUS_DRIVING, type RacingCar } from './car/runtime';
import { rayAngles, type RacingInputConfig } from './sensors/inputConfig';
import { racingInputSchema, type CustomSensorSpec } from './sensors/inputSchema';
import { RacingObserver } from './sensors/observe';
import type { Track } from './track/types';

export interface RacingEnvOptions {
  track: Track;
  car: CarParams;
  inputs: RacingInputConfig;
  controller: AgentController<RacingCar>;
  /** Episode length in seconds. */
  maxTime: number;
  customSensors?: CustomSensorSpec[];
  /**
   * Lesion test: inputs forced to a fixed normalized value after sensing.
   * Only the Sandbox sets this; training never does.
   */
  lesion?: ReadonlyArray<readonly [index: number, value: number]>;
}

/** 8 floats per car. Shared by the population stream and the ghost stream. */
export const RACING_SNAPSHOT: SnapshotLayout = {
  stride: 8,
  fields: ['x', 'y', 'heading', 'speed', 'steer', 'pedal', 'status', 'progress'],
};

/**
 * Many independent cars on one track, stepped in lockstep. Cars never touch
 * each other, so a car's path depends only on its brain, the track and its
 * seed. That is what makes ghost replays exact: re-simulating one champion
 * alone gives the same ticks as it had in its 100-car generation.
 */
export class RacingEnv {
  readonly opts: RacingEnvOptions;
  readonly observer: RacingObserver;
  readonly inputCount: number;
  cars: RacingCar[] = [];
  private brains: Network[] = [];
  private obs: Float64Array[] = [];
  private actions: Float64Array[] = [];
  private noise: Array<Rng | null> = [];
  private readonly io = makeTickIO(2, 2);
  tick = 0;
  active = 0;

  constructor(opts: RacingEnvOptions) {
    this.opts = opts;
    this.observer = new RacingObserver(opts.inputs, opts.car, rayAngles(opts.inputs.rays.count, opts.inputs.rays.fov));
    this.inputCount = racingInputSchema(opts.inputs, opts.car, opts.customSensors).length;
  }

  inputSchema(): InputSpec[] {
    return racingInputSchema(this.opts.inputs, this.opts.car, this.opts.customSensors);
  }

  /** Starts a fresh episode with one car per brain. `seeds` drive per-car sensor noise. */
  reset(brains: Network[], seeds: number[] = []): void {
    const { track, inputs } = this.opts;
    this.brains = brains;
    this.cars = brains.map((_, i) => createRacingCar(i, track, inputs.rays.count, seeds[i] ?? i));
    this.obs = brains.map(() => new Float64Array(this.inputCount));
    this.actions = brains.map(() => new Float64Array(2));
    this.noise = brains.map((_, i) => (inputs.noise > 0 ? new Rng(seeds[i] ?? i) : null));
    this.tick = 0;
    this.active = brains.length;
  }

  get done(): boolean {
    return this.active === 0;
  }

  /** Advances every car that is still driving by one 1/30 s tick. */
  step(): void {
    const { track, car: params, controller, maxTime } = this.opts;
    const io = this.io;
    for (let i = 0; i < this.cars.length; i++) {
      const rc = this.cars[i];
      if (rc.status !== STATUS_DRIVING) continue;
      const act = this.actions[i];
      stepCar(rc.car, act[0], act[1], params);
      updateTrackState(rc, track);
      this.observe(i);
      this.brains[i].activate(this.obs[i], io.brain);
      io.action[0] = 0;
      io.action[1] = 0;
      io.reward = 0;
      io.stop = null;
      controller.tick(rc, io);
      rc.fitness += io.reward;
      act[0] = io.action[0];
      act[1] = io.action[1];
      if (io.stop) stopCar(rc, io.stop);
      else if (rc.hitBarrier) stopCar(rc, 'crash');
      else if (rc.time >= maxTime - 1e-9) stopCar(rc, 'time');
      if (rc.status !== STATUS_DRIVING) this.active--;
    }
    this.tick++;
  }

  /** Fills the observation vector for car i: built-in inputs, then script sensors. */
  observe(i: number): Float64Array {
    const rc = this.cars[i];
    const out = this.obs[i];
    this.observer.castRays(rc, this.opts.track);
    const n = this.observer.write(rc, this.opts.track, out, this.noise[i]);
    if (this.opts.controller.customSensorCount > 0) this.opts.controller.sensors(rc, out, n);
    if (this.opts.lesion) for (const [k, v] of this.opts.lesion) if (k < out.length) out[k] = v;
    return out;
  }

  /** Latest observation of car i, without recomputing it. */
  lastObservation(i: number): Float64Array {
    return this.obs[i];
  }

  snapshot(out: Float32Array, offset = 0): void {
    const stride = RACING_SNAPSHOT.stride;
    for (let i = 0; i < this.cars.length; i++) {
      const rc = this.cars[i];
      const o = offset + i * stride;
      out[o] = rc.car.x;
      out[o + 1] = rc.car.y;
      out[o + 2] = rc.car.heading;
      out[o + 3] = rc.car.speed;
      out[o + 4] = rc.car.steer;
      out[o + 5] = rc.car.pedal;
      out[o + 6] = rc.status;
      out[o + 7] = rc.progress;
    }
  }
}
