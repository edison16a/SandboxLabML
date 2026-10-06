import { createAgent, HIDER, SEEKER, type HideSeekAgent } from '../agents/agent';
import type { MatchSetup } from '../layouts/spawn';
import { BOX_COUNT, matchTicks, prepTicks, type HideSeekPhysics } from '../physics';
import type { ArenaWorld, PlanarVelocity } from '../world/arena';

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
  /** Agent slot of the team that locked it, or -1. Only hiders lock, so it is HIDER or -1. */
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
  /** Tick of the first sighting in the seek phase, or -1. */
  firstSeenTick: number;
  locks: number;
  unlocks: number;
}

/** Everything one running match knows. The step systems all read and write this. */
export interface MatchState {
  readonly physics: HideSeekPhysics;
  readonly arena: ArenaWorld;
  readonly agents: [HideSeekAgent, HideSeekAgent];
  readonly controls: [AgentControl, AgentControl];
  readonly boxes: BoxState[];
  readonly tally: MatchTally;
  readonly totalTicks: number;
  readonly prepTicks: number;
  /** Physics steps completed. */
  tick: number;
}

function createControl(): AgentControl {
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

/** A fresh match state on a world that `setup` has just been applied to. */
export function createMatchState(arena: ArenaWorld, setup: MatchSetup, rayCounts: [number, number]): MatchState {
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
    boxes.push({ x: b.x, z: b.z, yaw: b.yaw, lockedBy: -1, heldBy: -1, spawnX: b.x, spawnZ: b.z, travel: 0 });
  }
  return {
    physics: p,
    arena,
    agents,
    controls: [createControl(), createControl()],
    boxes,
    tally: { seekTicks: 0, hiddenTicks: 0, seenTicks: 0, firstSeenTick: -1, locks: 0, unlocks: 0 },
    totalTicks: matchTicks(p),
    prepTicks: prepTicks(p),
    tick: 0,
  };
}

/** True when step number `tick` (1 based) belongs to the prep phase. */
export function isPrepStep(s: MatchState, tick: number): boolean {
  return tick <= s.prepTicks;
}
