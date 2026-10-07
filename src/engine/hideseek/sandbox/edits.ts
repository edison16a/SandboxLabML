import { HIDER } from '../agents/agent';
import { placeClimbers } from '../agents/climb/ramp';
import { releaseBox } from '../agents/grab';
import { setBoxLock } from '../agents/lock';
import { updateSandboxDerived } from './derived';
import type { SandboxState } from './state';

/**
 * Changes a person makes to a running Sandbox match. Each one changes the
 * world right away (the cached pose too, so the next snapshot shows it) and
 * the physics carries on from there on the next step. Like everything else
 * they are deterministic: the same edits on the same ticks replay exactly.
 */

/** Moves box `index` to (x, z), keeping its yaw. A held box is dropped first. Out of range indexes are ignored. */
export function moveSandboxBox(s: SandboxState, index: number, x: number, z: number): void {
  const b = s.boxes[index];
  if (!b) return;
  if (b.heldBy >= 0) releaseBox(s, b.heldBy);
  b.x = x;
  b.z = z;
  s.arena.teleport(s.arena.boxes[index], b);
  placeClimbers(s);
  updateSandboxDerived(s);
}

/** Locks a box for the hiders, or frees it, whoever holds it. */
export function lockSandboxBox(s: SandboxState, index: number, locked: boolean): void {
  if (!s.boxes[index]) return;
  setBoxLock(s, index, locked ? HIDER : -1);
  updateSandboxDerived(s);
}
