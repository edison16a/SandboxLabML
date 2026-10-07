import { createAgent, HIDER, SEEKER, type HideSeekAgent } from '../agents/agent';
import type { MatchSetup } from '../layouts/spawn';
import { BOX_COUNT, BOX_KINDS, matchTicks, prepTicks, type BoxKind, type HideSeekPhysics } from '../physics';
import type { ArenaWorld } from '../world/arena';
import type { PlanarVelocity, RoomWorld } from '../world/room';

/**
 * Per-agent state the script view does not expose: the latest actions,
 * the commanded velocity and the pose of a held box relative to the agent.
 */
export interface AgentControl {
  move: number;
  turn: number;
  grab: boolean;
  lock: boolean;
  /** Lock output on the previous tick, so a lock fires once per press. */
  lockWasOn: boolean;
  /** Held box pose in the agent frame, captured at grab time. */
  holdAhead: number;
  holdLeft: number;
  holdYaw: number;
  /** Velocity commanded for the coming step, used to lead a held box. */
  command: PlanarVelocity;
  /** Velocity measured after the latest step. */
  measured: PlanarVelocity;
}

export interface BoxState {
  x: number;
  z: number;
  yaw: number;
  readonly kind: BoxKind;
  /** Team index (see HideSeekAgent.index) of the team that locked it and owns the lock, or -1 while free. */
  lockedBy: number;
  /** Agent slot holding it, or -1. */
  heldBy: number;
  spawnX: number;
  spawnZ: number;
  /** Meters traveled this match. */
  travel: number;
}

/** Counters that become the match result. */
export interface MatchTally {
  seekTicks: number;
  hiddenTicks: number;
  seenTicks: number;
  /** Seek phase ticks the hider spent exposed (see HideSeekAgent.exposed). */
  exposedTicks: number;
  /** Tick of the first sighting in the seek phase, or -1. */
  firstSeenTick: number;
  /** Lock and unlock events of both teams. */
  locks: number;
  unlocks: number;
}

/**
 * What the per-agent systems read and write: movement, grab, lock, sensor
 * rays, the observer and the physics sync. They index agents by slot and
 * check teams through `HideSeekAgent.index`, so they work the same for a
 * 1 v 1 match and for the Sandbox with many players and boxes.
 */
export interface PlayState {
  readonly physics: HideSeekPhysics;
  readonly arena: RoomWorld;
  /** One per agent slot, the same order as `arena.agents`. */
  readonly agents: readonly HideSeekAgent[];
  readonly controls: readonly AgentControl[];
  readonly boxes: BoxState[];
  readonly tally: MatchTally;
  readonly totalTicks: number;
  readonly prepTicks: number;
  /** Physics steps completed. */
  tick: number;
}

/** Everything one running 1 v 1 match knows: slot 0 is the hider and slot 1 the seeker. */
export interface MatchState extends PlayState {
  readonly arena: ArenaWorld;
  readonly agents: [HideSeekAgent, HideSeekAgent];
  readonly controls: [AgentControl, AgentControl];
}

/** Fresh per-agent controls: no actions yet and nothing held. */
export function createControl(): AgentControl {
  return {
    move: 0,
    turn: 0,
    grab: false,
    lock: false,
    lockWasOn: false,
    holdAhead: 0,
    holdLeft: 0,
    holdYaw: 0,
    command: { vx: 0, vz: 0, spin: 0 },
    measured: { vx: 0, vz: 0, spin: 0 },
  };
}

/** Empty match counters. */
export function createTally(): MatchTally {
  return { seekTicks: 0, hiddenTicks: 0, seenTicks: 0, exposedTicks: 0, firstSeenTick: -1, locks: 0, unlocks: 0 };
}

/**
 * Prep ticks for a match: the physics share, or `prepSeconds` when given.
 * At least one tick is always left for seeking, so results stay defined.
 */
export function matchPrepTicks(p: HideSeekPhysics, prepSeconds?: number): number {
  if (prepSeconds === undefined || !Number.isFinite(prepSeconds)) return prepTicks(p);
  return Math.max(0, Math.min(matchTicks(p) - 1, Math.round(prepSeconds / p.dt)));
}

/** A fresh match state on a world that `setup` has just been applied to. */
export function createMatchState(arena: ArenaWorld, setup: MatchSetup, rayCounts: [number, number], prepSeconds?: number): MatchState {
  const p = arena.physics;
  const agents: [HideSeekAgent, HideSeekAgent] = [createAgent(HIDER, rayCounts[0], p.dt), createAgent(SEEKER, rayCounts[1], p.dt)];
  agents.forEach((a, i) => {
    a.x = setup.agents[i].x;
    a.z = setup.agents[i].z;
    a.yaw = setup.agents[i].yaw;
  });
  const boxes: BoxState[] = [];
  for (let i = 0; i < BOX_COUNT; i++) {
    const b = setup.boxes[i];
    boxes.push({ x: b.x, z: b.z, yaw: b.yaw, kind: BOX_KINDS[i], lockedBy: -1, heldBy: -1, spawnX: b.x, spawnZ: b.z, travel: 0 });
  }
  return {
    physics: p,
    arena,
    agents,
    controls: [createControl(), createControl()],
    boxes,
    tally: createTally(),
    totalTicks: matchTicks(p),
    prepTicks: matchPrepTicks(p, prepSeconds),
    tick: 0,
  };
}
