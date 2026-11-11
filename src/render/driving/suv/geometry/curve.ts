/** Hermite smoothstep on 0..1, clamped outside. */
export const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * 1 between `a` and `b`, easing to 0 over `ramp` meters outside them. Used to
 * switch a feature (a scoop, a flare) on along part of the car's length.
 */
export function between(x: number, a: number, b: number, ramp: number): number {
  return smooth((x - a + ramp) / ramp) * smooth((b + ramp - x) / ramp);
}

/**
 * A smooth profile through key points (monotone cubic, Fritsch and Carlson).
 * The body is described as a few such profiles along its length. Monotone
 * splines never overshoot between keys, so a profile cannot sneak a bump
 * into the paint that nobody drew.
 */
export function profile(keys: ReadonlyArray<readonly [number, number]>): (x: number) => number {
  const n = keys.length;
  const xs = keys.map((k) => k[0]);
  const ys = keys.map((k) => k[1]);
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m: number[] = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/**
 * Points along a quadratic curve from `a` to `b` in a cross-section plane,
 * bowed outward by `bulge` meters at its middle. Outward is to the right of
 * the travel direction, which is outside the car for sections drawn from
 * the sill up and over to the roof.
 */
export function bowed(a: readonly [number, number], b: readonly [number, number], bulge: number, steps: number): Array<[number, number]> {
  const dz = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dz, dy) || 1;
  return quadratic(a, [(a[0] + b[0]) / 2 + (dy / len) * bulge * 2, (a[1] + b[1]) / 2 - (dz / len) * bulge * 2], b, steps);
}

/**
 * Points from `a` to a point on the centerline at height `y`, arriving level.
 * Mirrored, the two halves then join with no ridge or dip, which is what a
 * roof or a windshield needs.
 */
export function toCenter(a: readonly [number, number], y: number, steps: number): Array<[number, number]> {
  return quadratic(a, [a[0] * 0.5, y], [0, y], steps);
}

function quadratic(a: readonly [number, number], c: readonly [number, number], b: readonly [number, number], steps: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}
