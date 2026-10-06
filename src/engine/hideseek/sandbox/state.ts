import { createAgent, HIDER, SEEKER, type HideSeekAgent } from '../agents/agent';
import { createControl, createTally, matchPrepTicks, type AgentControl, type BoxState, type MatchTally, type PlayState } from '../match/state';
import { matchTicks, type HideSeekPhysics } from '../physics';
import type { RoomWorld } from '../world/room';
import type { SandboxSetup } from './spawn';

/**
 * Everything a running Sandbox match knows. Slots 0 to hiders - 1 are the
 * hiders and the rest are seekers; every agent's `index` is its team (0 or
 * 1), which is what the shared systems check.
 */
export interface SandboxState extends PlayState {
  readonly arena: RoomWorld;
  readonly agents: HideSeekAgent[];
  readonly controls: AgentControl[];
  readonly hiders: number;
  readonly seekers: number;
  /**
   * The opponent each agent's opponent inputs refer to, by slot: the
   * nearest opponent it sees, else the nearest opponent. Updated by the
   * vision step every tick.
   */
  readonly targets: Int32Array;
  /** Per seeker slot: some hider sees it. Drives the SEEN flag on seekers in the snapshot. */
  readonly seenByOpponent: Uint8Array;
}

/** A fresh state on a world that `setup` has just been built into. */
export function createSandboxState(
  arena: RoomWorld,
  setup: SandboxSetup,
  hiders: number,
  seekers: number,
  rayCounts: [number, number],
  p: HideSeekPhysics,
  prepSeconds?: number,
): SandboxState {
  const agents: HideSeekAgent[] = [];
  const controls: AgentControl[] = [];
  setup.agents.forEach((pose, slot) => {
    const team = slot < hiders ? HIDER : SEEKER;
    const a = createAgent(team, rayCounts[team], p.dt);
    a.x = pose.x;
    a.z = pose.z;
    a.yaw = pose.yaw;
    agents.push(a);
    controls.push(createControl());
  });
  const boxes: BoxState[] = setup.boxes.map((b) => ({
    x: b.pose.x,
    z: b.pose.z,
    yaw: b.pose.yaw,
    kind: b.kind,
    lockedBy: -1,
    heldBy: -1,
    spawnX: b.pose.x,
    spawnZ: b.pose.z,
    travel: 0,
  }));
  const tally: MatchTally = createTally();
  return {
    physics: p,
    arena,
    agents,
    controls,
    boxes,
    tally,
    hiders,
    seekers,
    targets: new Int32Array(agents.length).fill(-1),
    seenByOpponent: new Uint8Array(agents.length),
    totalTicks: matchTicks(p),
    prepTicks: matchPrepTicks(p, prepSeconds),
    tick: 0,
  };
}

/** Whether slot `slot` holds a hider. */
export function isHiderSlot(s: SandboxState, slot: number): boolean {
  return slot < s.hiders;
}
