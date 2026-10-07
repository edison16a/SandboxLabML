import { HIDER, SEEKER, type HideSeekTeam } from '../agents/agent';
import { placeClimbers, standOnFloor } from '../agents/climb/ramp';
import { releaseBox } from '../agents/grab';
import { setBoxLock } from '../agents/lock';
import type { MatchState } from './state';
import { updateDerived } from './sync';

/**
 * Edits to a running 1 v 1 match, used to set up test scenes. Each one
 * changes the world right away (the cached pose too, so the next snapshot
 * shows it) and the physics carries on from there on the next step. They
 * are deterministic, so a replay that makes the same edits on the same
 * ticks matches. The app's Sandbox plays SandboxMatch, whose edits live in
 * sandbox/edits.ts.
 */

/** Moves box `index` to (x, z), keeping its yaw. A held box is dropped first. */
export function sandboxMoveBox(s: MatchState, index: number, x: number, z: number): void {
  const b = s.boxes[index];
  if (b.heldBy >= 0) releaseBox(s, b.heldBy);
  b.x = x;
  b.z = z;
  s.arena.teleport(s.arena.boxes[index], b);
  placeClimbers(s);
  updateDerived(s);
}

/** Locks a box for the hiders, or frees it, whoever holds it. */
export function sandboxSetBoxLocked(s: MatchState, index: number, locked: boolean): void {
  setBoxLock(s, index, locked ? HIDER : -1);
  updateDerived(s);
}

/** Moves an agent to a pose on the floor. It drops anything it carries, and leaves any ramp or jump. */
export function sandboxMoveAgent(s: MatchState, team: HideSeekTeam, x: number, z: number, yaw: number): void {
  const i = team === 'hider' ? HIDER : SEEKER;
  releaseBox(s, i);
  standOnFloor(s, i, x, z, yaw);
  updateDerived(s);
}
