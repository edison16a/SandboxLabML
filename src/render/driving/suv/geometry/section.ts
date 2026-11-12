/**
 * A key point of a cross section, at (z, y), with the direction the
 * outline arrives in (`a`) and leaves in (`b`). Directions are angles in
 * radians from straight up, positive leaning in toward the centerline, so
 * 0 climbs the side, PI/2 runs flat across the roof and a negative angle
 * leans out. Equal angles join two spans smoothly; different ones make a
 * crease that catches a line of light.
 */
export interface Key {
  z: number;
  y: number;
  a: number;
  b: number;
}

export type Pt = [number, number];

/** Degrees to radians, so profiles can be written in degrees. */
export const deg = (d: number) => (d * Math.PI) / 180;

/** A key with the same direction in and out: a smooth joint. */
export const key = (z: number, y: number, angle: number, out = angle): Key => ({ z, y, a: angle, b: out });

/**
 * Points along the span from key p to key q, a cubic curve that leaves p
 * in its out direction and arrives at q in its in direction. `tension`
 * scales the handles: above 1 the span holds its directions longer and
 * turns tighter in the middle.
 */
export function span(p: Key, q: Key, steps: number, tension = 1): Pt[] {
  const h = Math.hypot(q.z - p.z, q.y - p.y) * 0.36 * tension;
  const c1: Pt = [p.z - Math.sin(p.b) * h, p.y + Math.cos(p.b) * h];
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

/** Evenly spaced points along a polyline, by arc length. */
export function resample(pts: Pt[], steps: number): Pt[] {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = acc[acc.length - 1] || 1;
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

/** The point a share `t` of the way along a polyline by arc length, and the unit outward normal there. */
export function along(pts: Pt[], t: number): { p: Pt; n: Pt } {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const d = Math.min(Math.max(t, 0), 1) * acc[acc.length - 1];
  let j = 0;
  while (j < pts.length - 2 && acc[j + 1] < d) j++;
  const f = (d - acc[j]) / (acc[j + 1] - acc[j] || 1);
  const dz = pts[j + 1][0] - pts[j][0];
  const dy = pts[j + 1][1] - pts[j][1];
  const len = Math.hypot(dz, dy) || 1;
  // Outward is to the right of travel: sections run from the sill up and over to the centerline.
  return { p: [pts[j][0] + dz * f, pts[j][1] + dy * f], n: [dy / len, -dz / len] };
}
