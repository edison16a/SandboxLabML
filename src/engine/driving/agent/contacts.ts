import { PED_RADIUS } from '../sensors/lidar';
import type { Nearby } from '../sensors/nearby';
import type { WorldState } from '../world/state';
import type { DrivingLearner } from './learner';

/** Wheel centers ahead of and behind the car's middle, m: half the wheelbase. */
export const WHEEL_X = 1.45;
/** The learner must be driving toward a car at least this fast for a new contact to be its doing, m/s. */
const CAR_CLOSING = 0.5;
/** The same for a person, m/s. */
const PED_CLOSING = 0.3;

/** True when two oriented boxes overlap (separating axis test on the four box axes). */
export function boxesOverlap(ax: number, ay: number, ah: number, al: number, aw: number, bx: number, by: number, bh: number, bl: number, bw: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const ca = Math.cos(ah);
  const sa = Math.sin(ah);
  const cb = Math.cos(bh);
  const sb = Math.sin(bh);
  // Project both boxes on each of the four axes; any gap means no contact.
  for (let k = 0; k < 4; k++) {
    const ux = k === 0 ? ca : k === 1 ? -sa : k === 2 ? cb : -sb;
    const uy = k === 0 ? sa : k === 1 ? ca : k === 2 ? sb : cb;
    const ra = al * Math.abs(ca * ux + sa * uy) + aw * Math.abs(-sa * ux + ca * uy);
    const rb = bl * Math.abs(cb * ux + sb * uy) + bw * Math.abs(-sb * ux + cb * uy);
    if (Math.abs(dx * ux + dy * uy) > ra + rb) return false;
  }
  return true;
}

/** Bit k of a contact set held in 32 bit words. */
function has(words: Uint32Array, k: number): boolean {
  return (words[k >>> 5] & (1 << (k & 31))) !== 0;
}

/** This tick's contacts, built here and then copied onto the learner. Shared, since learners are checked one at a time. */
const nowCars = new Uint32Array(2);
const nowPeds = new Uint32Array(4);

/**
 * Finds the cars and people the learner touches this tick and decides
 * which contacts are its fault. Traffic and people cannot see the learners,
 * so they drive and walk straight through them. A contact therefore counts
 * only on the tick it begins, and only when the learner caused it: the
 * other car or the person is ahead of its front axle, and the learner is
 * driving toward them (for a car, also closing on it). A car rolling into a
 * learner from behind or from the side, or a person walking into its flank,
 * is ignored until the overlap ends. The sets of current contacts live on
 * the learner as bit words, so this allocates nothing.
 */
export function detectContacts(l: DrivingLearner, world: WorldState, near: Nearby, half: number, halfWidth: number): void {
  const car = l.car;
  const ch = Math.cos(car.heading);
  const sh = Math.sin(car.heading);
  const vx = car.speed * ch;
  const vy = car.speed * sh;
  l.crashed = false;
  nowCars.fill(0);
  for (let n = 0; n < near.carCount; n++) {
    const i = near.cars[n];
    const dx = world.carX[i] - car.x;
    const dy = world.carY[i] - car.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 64) continue;
    const h = world.carHeading[i];
    if (!boxesOverlap(car.x, car.y, car.heading, half, halfWidth, world.carX[i], world.carY[i], h, world.carLength[i] / 2, world.carWidth[i] / 2)) continue;
    nowCars[i >>> 5] |= 1 << (i & 31);
    if (has(l.carContacts, i)) continue;
    const d = Math.sqrt(d2) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const toward = vx * ux + vy * uy;
    const closing = toward - world.carSpeed[i] * (Math.cos(h) * ux + Math.sin(h) * uy);
    if (dx * ch + dy * sh > WHEEL_X && toward > CAR_CLOSING && closing > CAR_CLOSING) l.crashed = true;
  }
  l.carContacts.set(nowCars);

  l.hitPedestrian = false;
  nowPeds.fill(0);
  const reachF = half + PED_RADIUS;
  const reachS = halfWidth + PED_RADIUS;
  for (let n = 0; n < near.pedCount; n++) {
    const i = near.peds[n];
    const dx = world.pedX[i] - car.x;
    const dy = world.pedY[i] - car.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 16) continue;
    const f = dx * ch + dy * sh;
    const s = -dx * sh + dy * ch;
    if (Math.abs(f) >= reachF || Math.abs(s) >= reachS) continue;
    nowPeds[i >>> 5] |= 1 << (i & 31);
    if (has(l.pedContacts, i)) continue;
    const toward = (vx * dx + vy * dy) / (Math.sqrt(d2) || 1);
    if (f > WHEEL_X && toward > PED_CLOSING) l.hitPedestrian = true;
  }
  l.pedContacts.set(nowPeds);
}
