import type { EpisodeEnv } from '../../env/episode';
import type { ScriptHost } from '../../training/scriptHost';
import type { DrivingLearner } from '../agent/learner';
import { builtinDrivingController } from '../builtinReward';
import { SUV } from '../car/params';
import { DrivingEnv, type DrivingBrain } from '../env';
import type { DrivingResult } from '../results';
import { drivingEnvOptions } from '../setup';
import { WORLD_SIZE } from '../snapshot';
import { combineLegs, type DrivingRunResult } from './results';
import type { DrivingRunSetup } from './setup';

/** Ticks the finished scene of a trip stays on before the next trip starts: 1.5 s, so a viewer sees how it ended. */
export const TRIP_HOLD = 45;
/** World header slots this env fills: the trip on screen and how many trips there are. */
export const WORLD_TRIP = 6;
export const WORLD_TRIPS = 7;

/**
 * A generation of Driving: every brain drives each trip of the setup, one
 * trip after another, and its fitness adds up over them. Each trip is its
 * own DrivingEnv with its own city life, reset when the trip starts, so a
 * brain's drive on a trip depends only on that trip, its brain and its
 * seed. A champion replayed alone drives exactly as it did in training,
 * even though alone it reaches the second trip sooner.
 */
export class DrivingTrips implements EpisodeEnv<DrivingRunResult> {
  readonly worldFloats = WORLD_SIZE;
  tick = 0;
  private envs: Array<DrivingEnv | null>;
  private trip = 0;
  private hold = 0;
  private brains: DrivingBrain[] = [];
  private seeds: number[] = [];
  private slots: number[] = [];
  private legs: DrivingResult[][] = [];

  constructor(
    readonly setup: DrivingRunSetup,
    private readonly host: ScriptHost,
    private readonly seed: number,
  ) {
    this.envs = setup.trips.map(() => null);
  }

  get agentCount(): number {
    return this.brains.length;
  }

  get raysPerAgent(): number {
    return this.setup.inputs.lidar.count;
  }

  get tripCount(): number {
    return this.setup.trips.length;
  }

  /** The trip being driven (or the last one, once done). */
  get tripIndex(): number {
    return Math.min(this.trip, this.tripCount - 1);
  }

  /** The env of the trip on screen. */
  get current(): DrivingEnv {
    return this.envOf(this.tripIndex);
  }

  get done(): boolean {
    return this.trip >= this.tripCount;
  }

  /** Builds a trip's env on first use. The controller is made per trip, so a script can read that trip's city. */
  private envOf(k: number): DrivingEnv {
    let env = this.envs[k];
    if (!env) {
      const trip = this.setup.trips[k];
      const opts = drivingEnvOptions(trip, SUV, this.setup.inputs, builtinDrivingController, { customSensors: this.host.customSensors, lesion: this.setup.lesion });
      const controller = this.host.createController<DrivingLearner>({ seed: this.seed, extra: { city: opts.city, route: opts.route, level: opts.level } });
      env = new DrivingEnv(controller ? { ...opts, controller } : opts);
      this.envs[k] = env;
    }
    return env;
  }

  reset(brains: DrivingBrain[], seeds: number[] = [], slots: number[] = []): void {
    this.brains = brains;
    this.seeds = seeds;
    this.slots = slots;
    this.legs = [];
    this.trip = 0;
    this.hold = 0;
    this.tick = 0;
    this.envOf(0).reset(brains, seeds, slots);
  }

  step(): void {
    if (this.done) return;
    const env = this.current;
    // Between trips the finished one keeps its city moving for a moment, with nobody driving.
    env.step();
    this.tick++;
    if (!env.done) return;
    if (this.hold === 0) this.legs.push(env.results());
    if (this.trip + 1 < this.tripCount && this.hold < TRIP_HOLD) {
      this.hold++;
      return;
    }
    this.trip++;
    this.hold = 0;
    if (this.trip < this.tripCount) this.envOf(this.trip).reset(this.brains, this.seeds, this.slots);
  }

  writeSnapshot(out: Float32Array, offset = 0): void {
    this.current.snapshot(out, offset);
  }

  writeWorld(out: Float32Array, offset: number): void {
    this.current.writeWorld(out, offset);
    out[offset + WORLD_TRIP] = this.tripIndex;
    out[offset + WORLD_TRIPS] = this.tripCount;
  }

  leaderIndex(): number {
    return this.current.leaderIndex();
  }

  /** Every brain's trips so far, folded together; final once done. */
  results(): DrivingRunResult[] {
    // While a finished trip holds its scene, its results are already in.
    const legs = this.legs.length > this.tripIndex ? this.legs : [...this.legs, this.current.results()];
    return this.brains.map((_, i) => combineLegs(legs.map((trip) => trip[i])));
  }

  lastObservation(i: number): Float64Array {
    return this.current.lastObservation(i);
  }

  /** The steering and pedal the brain last applied. */
  writeOutputs(i: number, out: Float32Array): void {
    const car = this.current.learners[i].car;
    out[0] = car.steerCmd;
    out[1] = car.pedal;
  }

  writeRays(i: number, out: Float32Array, offset: number): void {
    const l = this.current.learners[i];
    const range = this.setup.inputs.lidar.range;
    for (let r = 0; r < l.lidar.length; r++) out[offset + r] = l.lidar[r] / range;
  }
}
