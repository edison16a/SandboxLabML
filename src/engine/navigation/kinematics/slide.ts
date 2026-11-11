import { deepestOverlap, pushOut, type Vec2 } from './collide';

/**
 * What an agent can bump into this tick: the static solids and the movers
 * where they stand now, both packed as x, z, hx, hz.
 */
export interface CollisionWorld {
  solids: Float64Array;
  solidCount: number;
  movers: Float64Array;
  moverCount: number;
}

/** Overlap below this counts as touching, not inside, m: float noise after a push. */
export const TOUCH_EPS = 1e-6;
/** Longest sub step of a move, m: well under the radius, so a fast agent can never skip through a thin wall. */
const MAX_STEP = 0.1;

/** Bits slideMove and moverPush report. */
export const HIT_SOLID = 1;
export const HIT_MOVER = 2;
export const PUSHED = 4;
export const CRUSHED = 8;

const target: Vec2 = { x: 0, z: 0 };

/**
 * Tries one sub step to p + (sx, sz), pushed out of whatever it lands in.
 * It is taken only if the result overlaps no solid and no more of a mover
 * than the agent already did (an agent being squeezed may start a step a
 * hair inside one). Returns contact bits, or -1 when the step is refused.
 */
function tryStep(p: Vec2, sx: number, sz: number, r: number, w: CollisionWorld, moverSlack: number): number {
  target.x = p.x + sx;
  target.z = p.z + sz;
  let hits = 0;
  for (let pass = 0; pass < 3; pass++) {
    const a = pushOut(target, r, w.solids, w.solidCount, 1);
    const b = w.moverCount > 0 && pushOut(target, r, w.movers, w.moverCount, 1);
    if (a) hits |= HIT_SOLID;
    if (b) hits |= HIT_MOVER;
    if (!a && !b) break;
  }
  if (deepestOverlap(target.x, target.z, r, w.solids, w.solidCount) > TOUCH_EPS) return -1;
  if (w.moverCount > 0 && deepestOverlap(target.x, target.z, r, w.movers, w.moverCount) > moverSlack) return -1;
  p.x = target.x;
  p.z = target.z;
  return hits;
}

/**
 * Moves a circle by (dx, dz), sliding along whatever it meets. The move is
 * cut into short sub steps, each pushed out of every solid it lands in, so
 * it slides along walls and round corners at any speed. A sub step that
 * cannot be resolved (a gap too narrow, a corner pocket) falls back to
 * moving along x alone, then z alone, and only then stays put, so the
 * agent never ends inside a solid and never sticks to a wall it is
 * leaving. Returns contact bits (HIT_SOLID, HIT_MOVER).
 */
export function slideMove(p: Vec2, dx: number, dz: number, r: number, w: CollisionWorld): number {
  const len = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(len / MAX_STEP));
  const sx = dx / steps;
  const sz = dz / steps;
  let hits = 0;
  for (let s = 0; s < steps; s++) {
    const slack = w.moverCount > 0 ? Math.max(TOUCH_EPS, deepestOverlap(p.x, p.z, r, w.movers, w.moverCount)) : TOUCH_EPS;
    let h = tryStep(p, sx, sz, r, w, slack);
    if (h < 0) h = tryStep(p, sx, 0, r, w, slack);
    if (h < 0) h = tryStep(p, 0, sz, r, w, slack);
    if (h < 0) h = HIT_SOLID;
    hits |= h;
  }
  return hits;
}

const before: Vec2 = { x: 0, z: 0 };

/**
 * Lets the movers, which have just moved, shove the agent aside. It is
 * pushed out of them and then out of the solids; if that leaves it more
 * than `crushDepth` inside a mover, it was caught between the two and is
 * crushed. Solids always win, so an agent is never pushed into a wall.
 * Returns PUSHED, PUSHED | CRUSHED, or 0 when no mover touched it.
 */
export function moverPush(p: Vec2, r: number, w: CollisionWorld, crushDepth: number): number {
  if (w.moverCount === 0) return 0;
  before.x = p.x;
  before.z = p.z;
  if (!pushOut(p, r, w.movers, w.moverCount, 2)) return 0;
  pushOut(p, r, w.solids, w.solidCount, 4);
  if (deepestOverlap(p.x, p.z, r, w.solids, w.solidCount) > TOUCH_EPS) {
    // Shoved into a pocket the solids cannot settle: it stays where it was, and the mover's overlap decides.
    p.x = before.x;
    p.z = before.z;
  }
  return deepestOverlap(p.x, p.z, r, w.movers, w.moverCount) > crushDepth ? PUSHED | CRUSHED : PUSHED;
}
