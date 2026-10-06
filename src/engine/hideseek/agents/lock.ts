import type { PlayState } from '../match/state';
import { HIDER } from './agent';
import { releaseBox } from './grab';
import { canToggleLock, findBoxInFront } from './reach';

/**
 * Lock is a toggle fired on the rising edge of the lock output, so holding
 * the output high does not flip a box every tick. Only hiders lock: a hider
 * that is not carrying anything can lock the nearest free box in front of
 * it, or unlock one its team locked. Seekers have the output too, so both
 * teams share one brain shape, but for them it does nothing.
 */
export function updateLock(s: PlayState, i: number): void {
  const a = s.agents[i];
  const c = s.controls[i];
  const pressed = c.lock && !c.lockWasOn;
  c.lockWasOn = c.lock;
  if (!pressed || a.frozen || a.holding || a.index !== HIDER) return;
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
 * frees it when `owner` is -1. `owner` is a team index, so any hider may
 * later unlock a box another hider locked. A held box is dropped first.
 * Also used by the Sandbox, which may lock any box at any time.
 */
export function setBoxLock(s: PlayState, index: number, owner: number): void {
  const b = s.boxes[index];
  if (b.heldBy >= 0) releaseBox(s, b.heldBy);
  b.lockedBy = owner;
  s.arena.setFixed(s.arena.boxes[index], owner >= 0);
}
