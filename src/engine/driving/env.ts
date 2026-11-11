import { Rng } from '../core/rng';
import { makeTickIO, type AgentController, type InputSpec } from '../env/types';
import { createLearner, STATUS_ARRIVED, STATUS_DRIVING, stopLearner, type DrivingLearner } from './agent/learner';
import { detectEvents } from './agent/events';
import { trackRoute } from './agent/tracking';
import { stepCar } from './car/dynamics';
import { SIM_DT, SUV_SIZE, type CarParams } from './car/params';
import type { City } from './city/types';
import type { DrivingLevel } from './levels';
import type { Route } from './route/route';
import { lidarAngles, type DrivingInputConfig } from './sensors/inputConfig';
import { drivingInputSchema, type CustomSensorSpec } from './sensors/inputSchema';
import { Lidar } from './sensors/lidar';
import { Nearby } from './sensors/nearby';
import { writeObservation } from './sensors/observe';
import { perceive, type RoutePose } from './sensors/perception';
import { resultOf, type DrivingResult } from './results';
import { DRIVING_SNAPSHOT, writeLearner, writeWorld, WORLD_SIZE } from './snapshot';
import { CityWorld } from './world/cityWorld';

/** Anything that turns inputs into the two outputs: a NEAT network, or the autopilot for previews. */
export interface DrivingBrain {
  activate(inputs: ArrayLike<number>, out: Float64Array): void;
}

export interface DrivingEnvOptions {
  city: City;
  route: Route;
  level: DrivingLevel;
  car: CarParams;
  inputs: DrivingInputConfig;
  controller: AgentController<DrivingLearner>;
  /** Episode length, s. */
  maxTime: number;
  /** Seeds the city's people and traffic for this episode. */
  worldSeed: number;
  customSensors?: CustomSensorSpec[];
  /** Lesion test: inputs forced to a fixed normalized value after sensing. Only the Sandbox sets this. */
  lesion?: ReadonlyArray<readonly [index: number, value: number]>;
}

/**
 * A population of SUVs driving one route through one shared city, stepped
 * in lockstep at 30 Hz. The city's lights, people and traffic are stepped
 * once per tick and never react to the learners, and the learners never
 * see or touch each other. So a learner's drive depends only on its brain,
 * the route, the world seed and its own seed: a champion replayed alone
 * drives exactly as it did in its generation.
 */
export class DrivingEnv {
  readonly opts: DrivingEnvOptions;
  readonly world: CityWorld;
  readonly lidar: Lidar;
  readonly inputCount: number;
  learners: DrivingLearner[] = [];
  private brains: DrivingBrain[] = [];
  private obs: Float64Array[] = [];
  private actions: Float64Array[] = [];
  private noise: Array<Rng | null> = [];
  private readonly io = makeTickIO(2, 2);
  private readonly near = new Nearby();
  private readonly pose: RoutePose = { x: 0, y: 0, heading: 0, speed: 0, progress: 0, index: 0, half: SUV_SIZE.length / 2 };
  tick = 0;
  active = 0;

  constructor(opts: DrivingEnvOptions) {
    this.opts = opts;
    this.world = new CityWorld(opts.city, opts.level);
    this.lidar = new Lidar(lidarAngles(opts.inputs.lidar.count, opts.inputs.lidar.fov));
    this.inputCount = drivingInputSchema(opts.inputs, opts.car, opts.customSensors).length;
  }

  inputSchema(): InputSpec[] {
    return drivingInputSchema(this.opts.inputs, this.opts.car, this.opts.customSensors);
  }

  /**
   * A fresh episode with one learner per brain. `seeds` drive per learner
   * sensor noise; `slots` line learners up behind the start (the Sandbox);
   * training leaves it out so all start on the same spot.
   */
  reset(brains: DrivingBrain[], seeds: number[] = [], slots: number[] = []): void {
    const { route, inputs } = this.opts;
    this.brains = brains;
    this.learners = brains.map((_, i) => createLearner(i, route, inputs.lidar.count, seeds[i] ?? i, slots[i] ?? 0));
    this.obs = brains.map(() => new Float64Array(this.inputCount));
    this.actions = brains.map(() => new Float64Array(2));
    this.noise = brains.map((_, i) => (inputs.noise > 0 ? new Rng(seeds[i] ?? i) : null));
    const first = route.elements[0];
    this.world.reset(this.opts.worldSeed, { element: first, s0: route.startS - 30 - 7 * Math.max(0, ...slots), s1: route.startS + 35 });
    this.tick = 0;
    this.active = brains.length;
    // Sense once before the first step, so the first decision sees the street it starts on.
    for (let i = 0; i < this.learners.length; i++) this.sense(i);
  }

  get done(): boolean {
    return this.active === 0;
  }

  /** Advances the city, then every learner still driving, by one 1/30 s tick. */
  step(): void {
    const { city, route, car: params, controller, maxTime } = this.opts;
    this.world.step(SIM_DT);
    const io = this.io;
    for (let i = 0; i < this.learners.length; i++) {
      const l = this.learners[i];
      if (l.status !== STATUS_DRIVING) continue;
      const act = this.actions[i];
      stepCar(l.car, act[0], act[1], params);
      l.time += SIM_DT;
      trackRoute(l, city, route);
      this.sense(i);
      detectEvents(l, city, route, this.world.state, this.near, SUV_SIZE.length, SUV_SIZE.width, SIM_DT, this.opts.level);
      this.brains[i].activate(this.obs[i], io.brain);
      io.action[0] = 0;
      io.action[1] = 0;
      io.reward = 0;
      io.stop = null;
      controller.tick(l, io);
      l.fitness += io.reward;
      act[0] = io.action[0];
      act[1] = io.action[1];
      if (io.stop) stopLearner(l, io.stop);
      else if (l.crashed) stopLearner(l, 'crash');
      else if (l.hitPedestrian) stopLearner(l, 'pedestrian');
      else if (l.offRoad) stopLearner(l, 'offroad');
      else if (l.arrived) stopLearner(l, 'arrived');
      else if (l.lost || l.remaining < -9) stopLearner(l, 'lost');
      else if (l.time >= maxTime - 1e-9) stopLearner(l, 'time');
      if (l.status !== STATUS_DRIVING) this.active--;
    }
    this.tick++;
  }

  /** Perception, lidar and the observation vector for learner i. */
  private sense(i: number): void {
    const l = this.learners[i];
    const { city, route, inputs, car, controller, lesion } = this.opts;
    const state = this.world.state;
    const p = this.pose;
    p.x = l.car.x;
    p.y = l.car.y;
    p.heading = l.car.heading;
    p.speed = l.car.speed;
    p.progress = l.progress;
    p.index = l.routeIndex;
    // One pass over the city finds what is near; everything below looks only at that.
    const near = this.near.gather(state, l.car.x, l.car.y);
    perceive(city, route, state, near, p, l.sense);
    this.lidar.cast(city, state, near, l.car.x, l.car.y, l.car.heading, inputs.lidar.range, l.lidar, l.lidarKind);
    const out = this.obs[i];
    const n = writeObservation(l, inputs, car, out, this.noise[i]);
    if (controller.customSensorCount > 0) controller.sensors(l, out, n);
    if (lesion) for (const [k, v] of lesion) if (k < out.length) out[k] = v;
  }

  /** Latest observation of learner i, without recomputing it. */
  lastObservation(i: number): Float64Array {
    return this.obs[i];
  }

  /** The learner doing best right now: arrived first, else furthest along among those still driving. */
  leaderIndex(): number {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < this.learners.length; i++) {
      const l = this.learners[i];
      const score = l.status === STATUS_ARRIVED ? 1e6 - l.time : l.status === STATUS_DRIVING ? l.maxProgress : l.maxProgress - 1e5;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  /** Per learner outcome so far (final once done), in learner order. */
  results(): DrivingResult[] {
    const { route } = this.opts;
    return this.learners.map((l) => resultOf(l, route.startS, route.destS));
  }

  /** Per learner state, DRIVING_SNAPSHOT.stride floats each. */
  snapshot(out: Float32Array, offset = 0): void {
    const stride = DRIVING_SNAPSHOT.stride;
    for (let i = 0; i < this.learners.length; i++) writeLearner(this.learners[i], out, offset + i * stride);
  }

  /** The shared city (lights, cars, people), WORLD_SIZE floats. */
  writeWorld(out: Float32Array, offset = 0): void {
    writeWorld(this.world.state, this.opts.level.id, out, offset);
  }

  static readonly worldSize = WORLD_SIZE;
}
