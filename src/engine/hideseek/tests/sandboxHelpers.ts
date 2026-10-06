import { Network } from '../../neat/network';
import type { Pose } from '../frame';
import { STANDARD_HIDESEEK_INPUTS } from '../inputConfig';
import { hideSeekPhysics, type HideSeekPhysics } from '../physics';
import { SandboxMatch } from '../sandbox/match';
import type { SandboxRoom } from '../sandbox/room';
import type { SandboxBrain, SandboxTeamSetup } from '../sandbox/types';
import { updateSandboxDerived } from '../sandbox/derived';
import type { Rapier } from '../world/rapier';
import { randomGenomes } from './helpers';

export const inputs = STANDARD_HIDESEEK_INPUTS;

/** Rules with no prep phase, so seekers look from the first tick. */
export const NO_PREP = hideSeekPhysics({ prepShare: 0 });

/** A brain that never acts: every output 0, so move, turn, grab and lock all stay off. */
export function idleBrain(inputCount: number): SandboxBrain {
  return { inputCount, outputCount: 4, activate: (_inputs, out) => out.fill(0) };
}

/** A team of seeded random brains, one genome per slot so players differ. */
export function randomTeam(seed: number): SandboxTeamSetup {
  const genomes = randomGenomes(inputs, 16, seed);
  return { brain: (slot) => new Network(genomes[slot]), inputs, sensors: null };
}

export function idleTeam(): SandboxTeamSetup {
  const brain = new Network(randomGenomes(inputs, 1, 5)[0]);
  return { brain: () => idleBrain(brain.inputCount), inputs, sensors: null };
}

/** An open room with two short walls and a mix of boxes, like one a user might draw. */
export const DRAWN_ROOM: SandboxRoom = {
  id: 'drawn',
  name: 'Drawn',
  walls: [
    { from: [-2, -10], to: [-2, -4] },
    { from: [2, 4], to: [2, 10] },
  ],
  boxes: [
    { x: -6, z: 6, yaw: 0, kind: 'cube' },
    { x: 6, z: -6, yaw: 0, kind: 'cube' },
    { x: 0, z: 0, yaw: Math.PI / 2, kind: 'plank' },
    { x: -6, z: -6, yaw: 0, kind: 'plank' },
    { x: 6, z: 6, yaw: 0, kind: 'plank' },
  ],
  hiderSpawn: { minX: -9, maxX: -4, minZ: -3, maxZ: 3 },
  seekerSpawn: { minX: 4, maxX: 9, minZ: -3, maxZ: 3 },
};

export function sandbox(
  R: Rapier,
  opts: { room?: SandboxRoom; seed?: number; hiders?: number; seekers?: number; physics?: HideSeekPhysics; hider?: SandboxTeamSetup; seeker?: SandboxTeamSetup },
) {
  return new SandboxMatch(R, {
    room: opts.room ?? DRAWN_ROOM,
    seed: opts.seed ?? 1,
    hiders: opts.hiders ?? 4,
    seekers: opts.seekers ?? 3,
    hider: opts.hider ?? randomTeam(11),
    seeker: opts.seeker ?? randomTeam(12),
    physics: opts.physics ?? hideSeekPhysics(),
  });
}

/** Puts the player in `slot` at a pose by hand, as if it had spawned there. */
export function place(m: SandboxMatch, slot: number, pose: Pose): void {
  const s = m.state;
  Object.assign(s.agents[slot], pose);
  s.arena.teleport(s.arena.agents[slot], pose);
  updateSandboxDerived(s);
}
