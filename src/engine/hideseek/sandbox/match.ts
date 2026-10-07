import { mixSeed, Rng } from '../../core/rng';
import type { AgentController } from '../../env/types';
import { clearEvents, HIDER, SEEKER, type HideSeekAgent } from '../agents/agent';
import { updateClimb } from '../agents/climb/climb';
import { updateGrab } from '../agents/grab';
import { updateLock } from '../agents/lock';
import { driveAgent, updateFreeze } from '../agents/movement';
import { HIDESEEK_OUTPUT_COUNT } from '../inputConfig';
import { syncFromPhysics, updateClock } from '../match/sync';
import { hideSeekBrainInputs } from '../sensing/inputSchema';
import { HideSeekObserver } from '../sensing/observe';
import { SensorRays } from '../sensing/rays';
import { SightLines } from '../sensing/vision';
import { buildRoom } from '../world/build';
import type { Rapier } from '../world/rapier';
import { RoomWorld } from '../world/room';
import { updateSandboxDerived } from './derived';
import { lockSandboxBox, moveSandboxBox } from './edits';
import { roomWallRects, SANDBOX_LIMITS } from './room';
import { writeSandboxSnapshot } from './snapshot';
import { sandboxSetup } from './spawn';
import { createSandboxState, type SandboxState } from './state';
import type { SandboxBrain, SandboxOptions, SandboxTeamSetup } from './types';
import { SandboxVision } from './vision';

/** What one team shares between its players: the observer and the ray caster, both stateless between agents. */
interface TeamKit {
  setup: SandboxTeamSetup;
  observer: HideSeekObserver;
  rays: SensorRays;
}

/**
 * A Sandbox match: any number of trained hiders and seekers (up to
 * SANDBOX_LIMITS) in a preset room or one the user drew. It owns its own
 * Rapier world and runs the very same movement, grab, lock, ray and sight
 * code as a training match, tick for tick in the same order. Brain outputs
 * drive the players directly and nothing is rewarded, like the benchmark,
 * so the Sandbox can never change a training result.
 */
export class SandboxMatch {
  readonly state: SandboxState;
  readonly seed: number;
  /** One brain per slot, so each player can be inspected or lesioned on its own. */
  readonly brains: SandboxBrain[];
  private readonly teams: [TeamKit, TeamKit];
  private readonly sensors: Array<AgentController<HideSeekAgent> | null>;
  private readonly obs: Float64Array[];
  private readonly noise: Array<Rng | null>;
  private readonly sight: SightLines;
  private readonly vision: SandboxVision;
  private readonly out = new Float64Array(HIDESEEK_OUTPUT_COUNT);

  constructor(R: Rapier, opts: SandboxOptions) {
    const p = opts.physics;
    const hiders = clampCount(opts.hiders);
    const seekers = clampCount(opts.seekers);
    this.seed = opts.seed;
    this.teams = [opts.hider, opts.seeker].map((setup) => ({
      setup,
      observer: new HideSeekObserver(setup.inputs, p),
      rays: new SensorRays(setup.inputs.rays.count, setup.inputs.rays.range, p),
    })) as [TeamKit, TeamKit];
    const setup = sandboxSetup(opts.room, p, opts.seed, hiders, seekers);
    const walls = roomWallRects(opts.room, p);
    const arena = new RoomWorld(R, p, walls, buildRoom(R, p, walls, setup.agents, setup.boxes));
    this.state = createSandboxState(arena, setup, hiders, seekers, [opts.hider.inputs.rays.count, opts.seeker.inputs.rays.count], p, opts.prepSeconds);
    const n = this.state.agents.length;
    try {
      this.sensors = this.state.agents.map((a, slot) => this.teams[a.index].setup.sensors?.(mixSeed(opts.seed, 1000 + slot)) ?? null);
      this.brains = this.state.agents.map((a, slot) => {
        const brain = this.teams[a.index].setup.brain(slot);
        checkBrain(brain, this.teams[a.index].setup, this.sensors[slot]?.customSensorCount ?? 0, a.index === HIDER ? 'hider' : 'seeker');
        return brain;
      });
    } catch (err) {
      arena.dispose();
      throw err;
    }
    this.obs = this.brains.map((b) => new Float64Array(b.inputCount));
    this.noise = this.state.agents.map((a, slot) => (this.teams[a.index].setup.inputs.noise > 0 ? new Rng(mixSeed(opts.seed, slot + 1)) : null));
    this.sight = new SightLines(arena);
    this.vision = new SandboxVision(n);
    // A fresh Rapier world answers ray casts only after its first step, so
    // tick 0 fills everything except vision, which starts blank.
    updateClock(this.state);
    this.vision.reset(this.state);
    this.castRays();
    updateSandboxDerived(this.state);
  }

  get tick(): number {
    return this.state.tick;
  }

  get done(): boolean {
    return this.state.tick >= this.state.totalTicks;
  }

  /** Advances one tick, in the same order as a training match. Does nothing once the match is over. */
  step(): void {
    if (this.done) return;
    const s = this.state;
    const next = s.tick + 1;
    for (const a of s.agents) clearEvents(a);
    for (let i = 0; i < s.agents.length; i++) {
      updateFreeze(s, i, next);
      updateClimb(s, i);
      driveAgent(s, i);
      updateGrab(s, i);
      updateLock(s, i);
    }
    s.arena.step();
    s.tick = next;
    syncFromPhysics(s);
    updateClock(s);
    this.vision.update(s, this.sight);
    this.castRays();
    updateSandboxDerived(s);
    for (let i = 0; i < s.agents.length; i++) this.think(i);
  }

  /** Writes the frame (see writeSandboxSnapshot) into `out`. */
  snapshot(out: Float32Array): void {
    writeSandboxSnapshot(this.state, out);
  }

  /** The latest observation of the player in `slot`. */
  observation(slot: number): Float64Array {
    return this.obs[slot];
  }

  moveBox(index: number, x: number, z: number): void {
    moveSandboxBox(this.state, index, x, z);
  }

  setBoxLocked(index: number, locked: boolean): void {
    lockSandboxBox(this.state, index, locked);
  }

  /** Frees the Rapier world. The match cannot step afterwards. */
  dispose(): void {
    this.state.arena.dispose();
  }

  private castRays(): void {
    const s = this.state;
    const blindSeekers = s.tick <= s.prepTicks;
    for (let i = 0; i < s.agents.length; i++) {
      const a = s.agents[i];
      this.teams[a.index].rays.cast(s, i, a.index === SEEKER && blindSeekers);
    }
  }

  /** Observe, add script sensors, run the brain and apply its outputs as actions. */
  private think(i: number): void {
    const s = this.state;
    const a = s.agents[i];
    const obs = this.obs[i];
    const n = this.teams[a.index].observer.write(s, i, obs, this.noise[i]);
    const script = this.sensors[i];
    if (script && script.customSensorCount > 0) script.sensors(a, obs, n);
    const out = this.out;
    this.brains[i].activate(obs, out);
    const c = s.controls[i];
    c.move = out[0];
    c.turn = out[1];
    c.grab = out[2] > 0;
    c.lock = out[3] > 0;
  }
}

/** Player counts are whole numbers from 0 to the per team limit. */
function clampCount(n: number): number {
  return Math.max(0, Math.min(SANDBOX_LIMITS.playersPerTeam, Math.floor(Number.isFinite(n) ? n : 0)));
}

function checkBrain(brain: SandboxBrain, team: SandboxTeamSetup, customCount: number, name: string): void {
  const want = hideSeekBrainInputs(team.inputs, customCount);
  if (brain.inputCount !== want) throw new Error(`The ${name} brain has ${brain.inputCount} inputs but its input config needs ${want}.`);
  if (brain.outputCount !== HIDESEEK_OUTPUT_COUNT) throw new Error(`The ${name} brain has ${brain.outputCount} outputs but Hide and Seek needs ${HIDESEEK_OUTPUT_COUNT}.`);
}
