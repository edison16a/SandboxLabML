/** A point in a cross section plane, (z, y), or in any 2D view plane. */
export type Pt = [number, number];

/**
 * A key of a cross section at (z, y) with the angle the outline passes
 * through it at: radians from straight up, positive leaning in toward the
 * centerline. 0 climbs a vertical side, PI/2 runs flat across a roof.
 */
export interface Key {
  z: number;
  y: number;
  a: number;
}

export const deg = (d: number) => (d * Math.PI) / 180;

/** The angle of the straight line from p to q, in the same convention as a key's. */
export function chord(p: { z: number; y: number }, q: { z: number; y: number }): number {
  return Math.atan2(p.z - q.z, q.y - p.y);
}

/**
 * Points along a cubic from p to q that leaves p and arrives at q along
 * their angles. Handles scale with the chord, so a span keeps its shape
 * whatever its size.
 */
export function span(p: Key, q: Key, steps: number): Pt[] {
  const h = Math.hypot(q.z - p.z, q.y - p.y) * 0.36;
  const c1: Pt = [p.z - Math.sin(p.a) * h, p.y + Math.cos(p.a) * h];
  const c2: Pt = [q.z + Math.sin(q.a) * h, q.y - Math.cos(q.a) * h];
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const k0 = u * u * u;
    const k1 = 3 * u * u * t;
    const k2 = 3 * u * t * t;
    const k3 = t * t * t;
    out.push([k0 * p.z + k1 * c1[0] + k2 * c2[0] + k3 * q.z, k0 * p.y + k1 * c1[1] + k2 * c2[1] + k3 * q.y]);
  }
  return out;
}

/** A smooth outline through keys, `steps[i]` segments on span i; shared keys appear once. */
export function through(keys: Key[], steps: readonly number[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < keys.length - 1; i++) out.push(...span(keys[i], keys[i + 1], steps[i]).slice(i === 0 ? 0 : 1));
  return out;
}

/** Evenly spaced points along a polyline by arc length, `steps` segments. */
export function resample(pts: Pt[], steps: number): Pt[] {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = acc[acc.length - 1];
  if (total < 1e-9) return Array.from({ length: steps + 1 }, () => [pts[0][0], pts[0][1]] as Pt);
  const out: Pt[] = [];
  let j = 0;
  for (let i = 0; i <= steps; i++) {
    const d = (total * i) / steps;
    while (j < pts.length - 2 && acc[j + 1] < d) j++;
    const t = (d - acc[j]) / (acc[j + 1] - acc[j] || 1);
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t]);
  }
  return out;
}

/**
 * The point a share t of the way along a polyline by arc length. Outside
 * 0..1 it carries on straight along the end segments, which lets a patch
 * grow past its own outline.
 */
export function pointAt(pts: Pt[], t: number): Pt {
  return sampler(pts)(t);
}

/** pointAt for one polyline, with its lengths measured once, for curves sampled many times. */
export function sampler(pts: Pt[]): (t: number) => Pt {
  if (pts.length === 1) return () => [pts[0][0], pts[0][1]];
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = acc[acc.length - 1] || 1;
  return (t) => {
    const d = t * total;
    let j = 0;
    while (j < pts.length - 2 && acc[j + 1] < d) j++;
    const f = (d - acc[j]) / (acc[j + 1] - acc[j] || 1);
    return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f];
  };
}
