import { Rng } from '../core/rng';
import { makeTickIO, type AgentController, type InputSpec } from '../env/types';
import { createNavAgent, NAV_RUNNING, stopAgent, type NavAgent } from './agent';
import type { Course } from './course/build';
import { moverPosition } from './course/movers';
import { driveAgent, onSpikes, shoveAgent } from './kinematics/body';
import { pushOut } from './kinematics/collide';
import type { CollisionWorld } from './kinematics/slide';
import type { NavigationParams } from './params';
import { leaderOf, updateNearby, updateProgress } from './progress';
import { resultOf, type NavigationResult } from './result';
import type { NavigationInputConfig } from './sensors/inputConfig';
import { navigationInputSchema, type NavigationCustomSensor } from './sensors/inputSchema';
import { NavigationObserver } from './sensors/observe';
import type { RayWorld } from './sensors/raycast';
import { NAVIGATION_SNAPSHOT, WORLD_HEADER } from './snapshot';
import { writeAgentSnapshot } from './snapshotWrite';

/** Anything that turns inputs into outputs: an evolved Network, or a stand in such as the scripted navigator. */
export interface NavBrain {
  activate(inputs: ArrayLike<number>, out: Float64Array): void;
}

export interface NavigationEnvOptions {
  course: Course;
  params: NavigationParams;
  inputs: NavigationInputConfig;
  controller: AgentController<NavAgent>;
  /** Episode length, s. Defaults to the course's own time limit. */
  maxTime?: number;
  customSensors?: NavigationCustomSensor[];
  /** Lesion test: inputs forced to a fixed normalized value after sensing. Only the Sandbox sets this. */
  lesion?: ReadonlyArray<readonly [index: number, value: number]>;
}

/**
 * Many agents on one course, stepped in lockstep. Agents never touch each
 * other, so an agent's path depends only on its brain, the course and its
 * seed. That is what makes champion replays exact: re-running one agent
 * alone gives the same ticks it had in its 100 agent generation.
 */
export class NavigationEnv {
  readonly opts: NavigationEnvOptions;
  readonly course: Course;
  readonly observer: NavigationObserver;
  readonly inputCount: number;
  readonly maxTime: number;
  agents: NavAgent[] = [];
  tick = 0;
  active = 0;
  private brains: NavBrain[] = [];
  private obs: Float64Array[] = [];
  private actions: Float64Array[] = [];
  private noise: Array<Rng | null> = [];
  /** Stuck timer marks: progress when each agent's timer last reset. */
  private marks = new Float64Array(0);
  private readonly io = makeTickIO(2, 2);
  private readonly movers: Float64Array;
  private readonly world: CollisionWorld;
  private readonly rayWorld: RayWorld;
  private readonly at = { x: 0, z: 0 };

  constructor(opts: NavigationEnvOptions) {
    this.opts = opts;
    this.course = opts.course;
    this.maxTime = opts.maxTime ?? opts.course.timeLimit;
    this.observer = new NavigationObserver(opts.inputs, opts.params);
    this.inputCount = this.inputSchema().length;
    const c = opts.course;
    this.movers = new Float64Array(c.movers.length * 4);
    this.world = { solids: c.solidData, solidCount: c.solids.length, movers: this.movers, moverCount: c.movers.length };
    this.rayWorld = { ...this.world, spikes: c.spikeData, spikeCount: c.spikes.length };
    this.placeMovers(0);
  }

  inputSchema(): InputSpec[] {
    return navigationInputSchema(this.opts.inputs, this.opts.params, this.opts.customSensors);
  }

  /** Episode clock, s. */
  get time(): number {
    return this.tick * this.opts.params.dt;
  }

  get agentCount(): number {
    return this.agents.length;
  }

  get done(): boolean {
    return this.active === 0;
  }

  /** Starts a fresh episode with one agent per brain. `seeds` set each agent's start spot and noise. Slots are accepted for the generic pipeline and ignored: everyone starts on the pad. */
  reset(brains: NavBrain[], seeds: number[] = [], _slots: number[] = []): void {
    const { course, params, inputs } = this.opts;
    this.brains = brains;
    this.agents = brains.map((_, i) => createNavAgent(i, course, params, inputs.rays.count, seeds[i] ?? i, this.maxTime));
    // A course that puts something on the start pad must not trap anyone inside it from the first tick.
    for (const a of this.agents) pushOut(a, params.agent.radius, course.solidData, course.solids.length, 8);
    this.obs = brains.map(() => new Float64Array(this.inputCount));
    this.actions = brains.map(() => new Float64Array(2));
    this.noise = brains.map((_, i) => (inputs.noise > 0 ? new Rng(seeds[i] ?? i) : null));
    this.marks = new Float64Array(brains.length);
    this.tick = 0;
    this.active = brains.length;
    this.placeMovers(0);
  }

  /** Advances every running agent by one tick: movers shove, agents move, hazards and the finish are checked, then brains decide. */
  step(): void {
    const { params, controller } = this.opts;
    const dt = params.dt;
    this.placeMovers((this.tick + 1) * dt);
    const io = this.io;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      if (a.status !== NAV_RUNNING) continue;
      a.finishedNow = false;
      a.diedNow = false;
      const act = this.actions[i];
      const crushed = shoveAgent(a, params, this.world);
      if (!crushed) driveAgent(a, act[0], act[1], params, this.world);
      a.time += dt;
      let death: string | null = crushed ? 'crushed' : null;
      if (!death && onSpikes(a, this.course, params)) death = 'spikes';
      a.diedNow = death !== null;
      a.finishedNow = !death && a.x >= this.course.finishX;
      this.marks[i] = updateProgress(a, this.course, this.marks[i], params.dt);
      updateNearby(a, this.course, this.movers, params.agent.radius);
      this.observe(i);
      this.brains[i].activate(this.obs[i], io.brain);
      io.action[0] = 0;
      io.action[1] = 0;
      io.reward = 0;
      io.stop = null;
      controller.tick(a, io);
      a.fitness += io.reward;
      act[0] = io.action[0];
      act[1] = io.action[1];
      if (a.finishedNow) stopAgent(a, 'finished');
      else if (death) stopAgent(a, death);
      else if (io.stop) stopAgent(a, io.stop);
      else if (a.time >= this.maxTime - 1e-9) stopAgent(a, 'time');
      else if (a.noProgress >= params.stuckSeconds) stopAgent(a, 'stuck');
      if (a.status !== NAV_RUNNING) this.active--;
    }
    this.tick++;
  }

  /** Fills the observation vector for agent i: built in inputs, then script sensors. */
  observe(i: number): Float64Array {
    const a = this.agents[i];
    const out = this.obs[i];
    this.observer.castRays(a, this.rayWorld);
    const n = this.observer.write(a, this.course, out, this.noise[i]);
    if (this.opts.controller.customSensorCount > 0) this.opts.controller.sensors(a, out, n);
    if (this.opts.lesion) for (const [k, v] of this.opts.lesion) if (k < out.length) out[k] = v;
    return out;
  }

  /** Latest observation of agent i, without recomputing it. */
  lastObservation(i: number): Float64Array {
    return this.obs[i];
  }

  /** Moves every mover to where it stands at `time`. */
  private placeMovers(time: number): void {
    const list = this.course.movers;
    for (let k = 0; k < list.length; k++) {
      const m = list[k];
      moverPosition(m, time, this.at);
      this.movers[k * 4] = this.at.x;
      this.movers[k * 4 + 1] = this.at.z;
      this.movers[k * 4 + 2] = m.hx;
      this.movers[k * 4 + 3] = m.hz;
    }
  }

  /** Writes every agent's NAVIGATION_SNAPSHOT record into `out` from `offset`. */
  snapshot(out: Float32Array, offset = 0): void {
    for (let i = 0; i < this.agents.length; i++) writeAgentSnapshot(this.agents[i], out, offset + i * NAVIGATION_SNAPSHOT.stride);
  }

  /** The generic pipeline's name for snapshot(). */
  writeSnapshot(out: Float32Array): void {
    this.snapshot(out, 0);
  }

  /** Writes the world block (see snapshot.ts): the clock, then each mover's x and z. */
  writeWorld(out: Float32Array, offset = 0): void {
    out[offset] = this.time;
    out[offset + 1] = this.course.movers.length;
    for (let k = 0; k < this.course.movers.length; k++) {
      out[offset + WORLD_HEADER + k * 2] = this.movers[k * 4];
      out[offset + WORLD_HEADER + k * 2 + 1] = this.movers[k * 4 + 1];
    }
  }

  /** The agent doing best right now (see leaderOf), or -1 before reset. */
  leaderIndex(): number {
    return leaderOf(this.agents, this.maxTime);
  }

  /** Per agent outcome, in brain order. */
  results(): NavigationResult[] {
    return this.agents.map(resultOf);
  }
}
