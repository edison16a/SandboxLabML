import type { PlayState } from '../match/state';
import { releaseBox } from './grab';
import { canToggleLock, findBoxInFront } from './reach';

/**
 * Lock is a toggle fired on the rising edge of the lock output, so holding
 * the output high does not flip a box every tick. Both teams lock: an agent
 * that is free to act, has empty hands and stands on the floor can lock the
 * nearest free box in front of it (a crate or a ramp), or unlock one its
 * own team locked. The locking team owns the lock, so the other team can
 * neither unlock nor move that box. Seekers are frozen during prep, so in
 * practice they lock in the seek phase.
 */
export function updateLock(s: PlayState, i: number): void {
  const a = s.agents[i];
  const c = s.controls[i];
  const pressed = c.lock && !c.lockWasOn;
  c.lockWasOn = c.lock;
  if (!pressed || a.frozen || a.holding || a.climbing || a.airborne) return;
  const l = s.physics.lock;
  const index = findBoxInFront(s, i, l.range, l.cone, canToggleLock);
  if (index < 0) return;
  if (s.boxes[index].lockedBy < 0) {
    setBoxLock(s, index, a.index);
    a.justLocked = true;
    a.locks++;
    s.tally.locks++;
  } else {
    setBoxLock(s, index, -1);
    a.justUnlocked = true;
    a.unlocks++;
    s.tally.unlocks++;
  }
}

/**
 * Locks a box for a team (it becomes a fixed body nobody can push) or
 * frees it when `owner` is -1. `owner` is a team index, so any agent of
 * that team may later unlock it. A held box is dropped first. Also used by
 * the Sandbox, which may lock any box at any time.
 */
export function setBoxLock(s: PlayState, index: number, owner: number): void {
  const b = s.boxes[index];
  if (b.heldBy >= 0) releaseBox(s, b.heldBy);
  b.lockedBy = owner;
  s.arena.setFixed(s.arena.boxes[index], owner >= 0);
}
