import type { BoxKind } from '../boxKinds';
import type { BoxState } from '../match/state';
import { lockCode } from '../snapshot';

/**
 * The bits field of a Sandbox box: its kind, whether it is locked and which
 * team owns the lock. A ramp has BOX_RAMP, a plank BOX_PLANK and a cube
 * neither. BOX_SEEKER_LOCK is set next to BOX_LOCKED when the seekers own
 * the lock.
 */
export const BOX_LOCKED = 1;
export const BOX_PLANK = 2;
export const BOX_RAMP = 4;
export const BOX_SEEKER_LOCK = 8;

/** The bits of a box. */
export function sandboxBoxBits(b: BoxState): number {
  const kind = b.kind === 'ramp' ? BOX_RAMP : b.kind === 'plank' ? BOX_PLANK : 0;
  return kind | (b.lockedBy >= 0 ? BOX_LOCKED : 0) | (b.lockedBy > 0 ? BOX_SEEKER_LOCK : 0);
}

/** A box's kind from its bits. */
export function sandboxBoxKind(bits: number): BoxKind {
  return (bits & BOX_RAMP) !== 0 ? 'ramp' : (bits & BOX_PLANK) !== 0 ? 'plank' : 'cube';
}

/** A box's lock from its bits, as an arena lock value (LOCK_FREE, LOCK_HIDERS or LOCK_SEEKERS). */
export function sandboxBoxLock(bits: number): number {
  if ((bits & BOX_LOCKED) === 0) return lockCode(-1);
  return lockCode((bits & BOX_SEEKER_LOCK) !== 0 ? 1 : 0);
}
