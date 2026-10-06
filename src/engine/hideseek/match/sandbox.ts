import { HIDER, SEEKER, type HideSeekTeam } from '../agents/agent';
import { releaseBox } from '../agents/grab';
import { setBoxLock } from '../agents/lock';
import type { MatchState } from './state';
import { updateDerived } from './sync';

/**
 * Sandbox edits a person makes mid match. Each one changes the world right
 * away (the cached pose too, so the next snapshot shows it) and the
 * physics carries on from there on the next step. They are deterministic,
 * so a replay that makes the same edits on the same ticks matches.
 */

/** Moves box `index` to (x, z), keeping its yaw. A held box is dropped first. */
export function sandboxMoveBox(s: MatchState, index: number, x: number, z: number): void {
  const b = s.boxes[index];
  if (b.heldBy >= 0) releaseBox(s, b.heldBy);
  b.x = x;
  b.z = z;
  s.arena.teleport(s.arena.boxes[index], b);
  updateDerived(s);
}

/** Locks a box for the hiders, or frees it, whoever holds it. */
export function sandboxSetBoxLocked(s: MatchState, index: number, locked: boolean): void {
  setBoxLock(s, index, locked ? HIDER : -1);
  updateDerived(s);
}

/** Moves an agent to a pose. It drops anything it carries. */
export function sandboxMoveAgent(s: MatchState, team: HideSeekTeam, x: number, z: number, yaw: number): void {
  const i = team === 'hider' ? HIDER : SEEKER;
  const a = s.agents[i];
  releaseBox(s, i);
  a.x = x;
  a.z = z;
  a.yaw = yaw;
  s.arena.teleport(s.arena.agents[i], a);
  updateDerived(s);
}
