import type { Vec2 } from './types';

/**
 * Samples a closed centripetal Catmull-Rom spline. Centripetal
 * parameterization (alpha 0.5) avoids the loops and cusps the uniform
 * version makes when control points are unevenly spaced, which matters
 * because users drag points around freely in the editor.
 */
export function sampleClosedSpline(points: Vec2[], perSegment = 48): Vec2[] {
  const n = points.length;
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const t0 = 0;
    const t1 = t0 + knot(p0, p1);
    const t2 = t1 + knot(p1, p2);
    const t3 = t2 + knot(p2, p3);
    for (let k = 0; k < perSegment; k++) {
      const t = t1 + ((t2 - t1) * k) / perSegment;
      out.push(barryGoldman(p0, p1, p2, p3, t0, t1, t2, t3, t));
    }
  }
  return out;
}

function knot(a: Vec2, b: Vec2): number {
  return Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
}

function mix(a: Vec2, b: Vec2, ta: number, tb: number, t: number): Vec2 {
  const u = (tb - t) / (tb - ta);
  const v = (t - ta) / (tb - ta);
  return [a[0] * u + b[0] * v, a[1] * u + b[1] * v];
}

/** The Barry-Goldman pyramid evaluation of a Catmull-Rom segment. */
function barryGoldman(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t0: number, t1: number, t2: number, t3: number, t: number): Vec2 {
  const a1 = mix(p0, p1, t0, t1, t);
  const a2 = mix(p1, p2, t1, t2, t);
  const a3 = mix(p2, p3, t2, t3, t);
  const b1 = mix(a1, a2, t0, t2, t);
  const b2 = mix(a2, a3, t1, t3, t);
  return mix(b1, b2, t1, t2, t);
}

/** Resamples a closed polyline at an even spacing along its length. */
export function resampleClosed(poly: Vec2[], count: number): { points: Vec2[]; length: number } {
  const n = poly.length;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const length = cum[n];
  const points: Vec2[] = [];
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const target = (k * length) / count;
    while (seg < n - 1 && cum[seg + 1] < target) seg++;
    const a = poly[seg];
    const b = poly[(seg + 1) % n];
    const span = cum[seg + 1] - cum[seg] || 1;
    const t = (target - cum[seg]) / span;
    points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return { points, length };
}
