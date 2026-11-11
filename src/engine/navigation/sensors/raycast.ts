import { RAY_MOVER, RAY_NONE, RAY_SOLID, RAY_SPIKES } from '../agent';

/**
 * Distance along the ray from (ox, oz) in unit direction (dx, dz) to the
 * nearest of `count` packed rectangles, or `max` when none is nearer. A
 * slab test per rectangle; an origin inside one reads 0.
 */
export function rayRects(ox: number, oz: number, dx: number, dz: number, max: number, rects: Float64Array, count: number): number {
  let best = max;
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const rx = rects[o];
    const rz = rects[o + 1];
    const hx = rects[o + 2];
    const hz = rects[o + 3];
    let t0 = 0;
    let t1 = best;
    if (Math.abs(dx) < 1e-12) {
      if (ox < rx - hx || ox > rx + hx) continue;
    } else {
      const a = (rx - hx - ox) / dx;
      const b = (rx + hx - ox) / dx;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
      if (t0 > t1) continue;
    }
    if (Math.abs(dz) < 1e-12) {
      if (oz < rz - hz || oz > rz + hz) continue;
    } else {
      const a = (rz - hz - oz) / dz;
      const b = (rz + hz - oz) / dz;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
      if (t0 > t1) continue;
    }
    best = t0;
  }
  return best;
}

/** What a cast found: the distance, m, and the kind of thing (RAY_*). */
export interface RayHit {
  distance: number;
  kind: number;
}

/** Packed rectangles of everything a ray can stop on, as they stand this tick. */
export interface RayWorld {
  solids: Float64Array;
  solidCount: number;
  spikes: Float64Array;
  spikeCount: number;
  movers: Float64Array;
  moverCount: number;
}

/**
 * Casts one ray through the course and reports the first thing it meets:
 * a solid (wall or block), a spike pad or a mover. Spikes stop a ray even
 * though an agent could step on them, because a ray is how an agent sees
 * danger ahead.
 */
export function castRay(w: RayWorld, ox: number, oz: number, dx: number, dz: number, range: number, out: RayHit): RayHit {
  let d = rayRects(ox, oz, dx, dz, range, w.solids, w.solidCount);
  let kind = d < range ? RAY_SOLID : RAY_NONE;
  const s = rayRects(ox, oz, dx, dz, d, w.spikes, w.spikeCount);
  if (s < d) {
    d = s;
    kind = RAY_SPIKES;
  }
  const m = rayRects(ox, oz, dx, dz, d, w.movers, w.moverCount);
  if (m < d) {
    d = m;
    kind = RAY_MOVER;
  }
  out.distance = d;
  out.kind = kind;
  return out;
}
