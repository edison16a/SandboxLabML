import { padOf, type Pad, type StadiumLayout } from '../stadium/layout';
import { PIT_LANE } from '../stadium/pitGeometry';
import { terrainHeight, type TerrainShape } from '../world/terrain/terrainHeight';

/**
 * Ground a camera must not stand on: each stand's footprint, and the pits
 * with the lane and canopy in front of them, so no camera ends up under
 * the canopy or on the pit lane.
 */
export function keepOut(l: StadiumLayout, grow: number): Pad[] {
  const out = l.stands.map((s) => padOf(l, l.side, s, grow));
  const pit = l.pit;
  if (pit) {
    const half = Math.max(pit.laneHalf ?? 0, pit.length / 2 + 0.6);
    // The lane reaches PIT_LANE meters toward the road from the facade.
    const area = { along: pit.along, length: half * 2, offset: pit.offset - PIT_LANE, depth: pit.depth + PIT_LANE };
    out.push(padOf(l, -l.side, area, grow));
  }
  return out;
}

/** Things tall enough to hide a car: the stands and the pit building itself (the canopy is above any sight line). */
export function occluders(l: StadiumLayout): Pad[] {
  const out = l.stands.map((s) => padOf(l, l.side, s, 0.5));
  if (l.pit) out.push(padOf(l, -l.side, l.pit, 0.5));
  return out;
}

/** True when the segment from (ax, az) to (bx, bz) passes through the pad's rectangle (a slab test in its frame). */
export function crosses(p: Pad, ax: number, az: number, bx: number, bz: number): boolean {
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  // World to the pad's frame, the inverse of padOf's rotation.
  const u0 = (ax - p.x) * c - (az - p.z) * s;
  const v0 = (ax - p.x) * s + (az - p.z) * c;
  const du = (bx - p.x) * c - (bz - p.z) * s - u0;
  const dv = (bx - p.x) * s + (bz - p.z) * c - v0;
  let lo = 0;
  let hi = 1;
  for (const [o, d, h] of [[u0, du, p.halfLength], [v0, dv, p.halfDepth]]) {
    if (Math.abs(d) < 1e-9) {
      if (Math.abs(o) > h) return false;
      continue;
    }
    let t0 = (-h - o) / d;
    let t1 = (h - o) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    lo = Math.max(lo, t0);
    hi = Math.min(hi, t1);
    if (lo > hi) return false;
  }
  return true;
}

/**
 * True when a camera at (x, y, z) can see a car at (tx, tz): no building in
 * between, and no hill rising over the line. A car's roof is about a meter
 * up, which is what the line aims at.
 */
export function canSee(shape: TerrainShape, blockers: Pad[], x: number, y: number, z: number, tx: number, tz: number): boolean {
  for (let k = 0; k < blockers.length; k++) if (crosses(blockers[k], x, z, tx, tz)) return false;
  for (let k = 1; k < 6; k++) {
    const t = k / 6;
    if (terrainHeight(shape, x + (tx - x) * t, z + (tz - z) * t) > y + (1 - y) * t - 0.3) return false;
  }
  return true;
}
