import { mixSeed, Rng } from '../../core/rng';
import { makeTickIO, type TickIO } from '../../env/types';
import { clearEvents, HIDER, SEEKER, type HideSeekAgent, type HideSeekTeam } from '../agents/agent';
import { updateGrab } from '../agents/grab';
import { updateLock } from '../agents/lock';
import { driveAgent, updateFreeze } from '../agents/movement';
import { HIDESEEK_OUTPUT_COUNT } from '../inputConfig';
import { sampleSetup, type MatchSetup } from '../layouts/spawn';
import { hideSeekBrainInputs } from '../sensing/inputSchema';
import { HideSeekObserver } from '../sensing/observe';
import { SensorRays } from '../sensing/rays';
import { SightLines, updateVision } from '../sensing/vision';
import { writeArenaSnapshot, writeRaySnapshot } from '../snapshot';
import type { ArenaWorld } from '../world/arena';
import { buildResult } from './result';
import { sandboxMoveAgent, sandboxMoveBox, sandboxSetBoxLocked } from './sandbox';
import { createMatchState, type MatchState } from './state';
import { syncFromPhysics, updateClock, updateDerived } from './sync';
import type { HideSeekMatchOptions, HideSeekTeamSetup, MatchResult } from './types';

/**
 * One 1 v 1 match in one pooled world. Headless runs call `run`; watch
 * mode and the arena grid call `step` once per tick and read snapshots in
 * between. Both go through the same `step`, so a live round and a Turbo
 * replay of it give identical results.
 *
 * A tick, in order: apply the actions chosen last tick (move, grab, lock),
 * step the physics, read the world back, update vision, rays and derived
 * fields, then let each brain and controller choose the next actions.
 */
export class HideSeekMatch {
  readonly state: MatchState;
  readonly seed: number;
  readonly setup: MatchSetup;
  private readonly teams: [HideSeekTeamSetup, HideSeekTeamSetup];
  private readonly rays: SensorRays[];
  private readonly observers: HideSeekObserver[];
  private readonly obs: Float64Array[];
  private readonly noise: Array<Rng | null>;
  private readonly sight: SightLines;
  private readonly io: TickIO = makeTickIO(HIDESEEK_OUTPUT_COUNT, HIDESEEK_OUTPUT_COUNT);
  private onRelease: (() => void) | null;

  /** Resets `arena` for this match. `onRelease` runs once, from `release`. */
  constructor(arena: ArenaWorld, opts: HideSeekMatchOptions, onRelease: (() => void) | null = null) {
    const p = arena.physics;
    this.seed = opts.seed;
    this.teams = [opts.hider, opts.seeker];
    this.teams.forEach((t, i) => checkBrain(t, i === HIDER ? 'hider' : 'seeker'));
    this.setup = sampleSetup(arena.layout, p, opts.seed);
    arena.reset(this.setup);
    this.state = createMatchState(arena, this.setup, [opts.hider.inputs.rays.count, opts.seeker.inputs.rays.count], opts.prepSeconds);
    this.rays = this.teams.map((t) => new SensorRays(t.inputs.rays.count, t.inputs.rays.range, p));
    this.observers = this.teams.map((t) => new HideSeekObserver(t.inputs, p));
    this.obs = this.teams.map((t) => new Float64Array(t.brain.inputCount));
    this.noise = this.teams.map((t, i) => (t.inputs.noise > 0 ? new Rng(mixSeed(opts.seed, i + 1)) : null));
    this.sight = new SightLines(arena);
    this.onRelease = onRelease;
    // A fresh Rapier world answers ray casts only after its first step, so
    // tick 0 fills everything except vision, which starts blank.
    updateClock(this.state);
    this.castRays();
    updateDerived(this.state);
  }

  get tick(): number {
    return this.state.tick;
  }

  get done(): boolean {
    return this.state.tick >= this.state.totalTicks;
  }

  get hider(): HideSeekAgent {
    return this.state.agents[HIDER];
  }

  get seeker(): HideSeekAgent {
    return this.state.agents[SEEKER];
  }

  /** Advances one 1/30 s tick. Does nothing once the match is over. */
  step(): void {
    if (this.done) return;
    const s = this.state;
    const next = s.tick + 1;
    for (const a of s.agents) clearEvents(a);
    for (let i = 0; i < s.agents.length; i++) {
      updateFreeze(s, i, next);
      driveAgent(s, i);
      updateGrab(s, i);
      updateLock(s, i);
    }
    s.arena.step();
    s.tick = next;
    syncFromPhysics(s);
    updateClock(s);
    updateVision(s, this.sight);
    this.castRays();
    updateDerived(s);
    for (let i = 0; i < s.agents.length; i++) this.think(i);
  }

  /** Plays the rest of the match headless and returns its result. */
  run(): MatchResult {
    while (!this.done) this.step();
    return this.result();
  }

  result(): MatchResult {
    return buildResult(this.state, this.state.arena.layout.id, this.seed);
  }

  /** Writes this arena's snapshot (see HIDESEEK_SNAPSHOT) into `out` at `offset`. */
  snapshot(out: Float32Array, offset = 0): void {
    writeArenaSnapshot(this.state, out, offset);
  }

  /** Writes the optional rays stream (see HIDESEEK_RAY_SNAPSHOT) into `out` at `offset`. */
  snapshotRays(out: Float32Array, offset = 0): void {
    writeRaySnapshot(this.state, this.rays, out, offset);
  }

  /** The latest observation of agent `i` (0 hider, 1 seeker), for the inputs overlay. */
  observation(i: number): Float64Array {
    return this.obs[i];
  }

  /** Sandbox: moves box `index` to (x, z) right away, keeping its yaw. A held box is dropped first. */
  moveBox(index: number, x: number, z: number): void {
    sandboxMoveBox(this.state, index, x, z);
  }

  /** Sandbox: locks a box for the hiders or frees it, whoever holds it. */
  setBoxLocked(index: number, locked: boolean): void {
    sandboxSetBoxLocked(this.state, index, locked);
  }

  /** Sandbox: moves an agent to a pose right away. It drops anything it carries. */
  moveAgent(team: HideSeekTeam, x: number, z: number, yaw: number): void {
    sandboxMoveAgent(this.state, team, x, z, yaw);
  }

  /** Hands the world back to its pool. Call once the match is no longer needed. */
  release(): void {
    const done = this.onRelease;
    this.onRelease = null;
    done?.();
  }

  private castRays(): void {
    const s = this.state;
    for (let i = 0; i < this.rays.length; i++) this.rays[i].cast(s, i, i === SEEKER && s.tick <= s.prepTicks);
  }

  /** Observe, run the brain, let the controller pick actions and reward. Stopped agents sit out. */
  private think(i: number): void {
    const s = this.state;
    const a = s.agents[i];
    if (a.stopReason !== null) return;
    const team = this.teams[i];
    const c = s.controls[i];
    const obs = this.obs[i];
    const io = this.io;
    const n = this.observers[i].write(s, i, obs, this.noise[i]);
    if (team.controller.customSensorCount > 0) team.controller.sensors(a, obs, n);
    team.brain.activate(obs, io.brain);
    io.action.fill(0);
    io.reward = 0;
    io.stop = null;
    team.controller.tick(a, io);
    a.fitness += io.reward;
    c.move = io.action[0];
    c.turn = io.action[1];
    c.grab = io.action[2] > 0;
    c.lock = io.action[3] > 0;
    if (io.stop) {
      a.stopReason = io.stop;
      c.grab = false;
      c.lock = false;
    }
  }
}

function checkBrain(t: HideSeekTeamSetup, team: HideSeekTeam): void {
  const want = hideSeekBrainInputs(t.inputs, t.controller.customSensorCount);
  if (t.brain.inputCount !== want) {
    throw new Error(`The ${team} brain has ${t.brain.inputCount} inputs but its input config needs ${want}.`);
  }
  if (t.brain.outputCount !== HIDESEEK_OUTPUT_COUNT) {
    throw new Error(`The ${team} brain has ${t.brain.outputCount} outputs but Hide and Seek needs ${HIDESEEK_OUTPUT_COUNT}.`);
  }
}
