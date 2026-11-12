import type { Vec3 } from '../../suv/geometry/grid';

/**
 * How far, m, the shoulder crease may bend away from the straight edge
 * between two upper panel rows before it gets a row of its own. Below it
 * the lower panel's crease point is moved onto that edge instead; a
 * centimeter is lost in the paint at street distance and saves rows.
 */
const TOLERANCE = 0.01;

const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** The j with xs[j] < x < xs[j + 1], or -1 when x is one of xs or outside them. xs is sorted. */
function bracket(xs: readonly number[], x: number): number {
  for (let j = 0; j < xs.length - 1; j++) {
    if (x === xs[j] || x === xs[j + 1]) return -1;
    if (xs[j] < x && x < xs[j + 1]) return j;
  }
  return -1;
}

/**
 * The upper panel's stations: its own, plus any lower station where the
 * shoulder crease bends away from the straight edge between the upper
 * rows by more than TOLERANCE. The lower panels have rows across every
 * wheel opening; where those fall in an end's rounding, the crease curves
 * in plan between two upper rows and the panels part along it, a crack
 * you could see into from above. Elsewhere the crease runs straight and
 * the upper panel stays light.
 */
export function creaseStations(upper: readonly number[], lower: readonly number[], crease: (x: number) => Vec3): number[] {
  const out = [...upper];
  for (;;) {
    let worst = -1;
    let most = TOLERANCE;
    for (const x of lower) {
      const j = bracket(out, x);
      if (j < 0) continue;
      const p = crease(x);
      const q = lerp(crease(out[j]), crease(out[j + 1]), (x - out[j]) / (out[j + 1] - out[j]));
      const off = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      if (off > most) {
        most = off;
        worst = x;
      }
    }
    if (worst < 0) return out;
    out.push(worst);
    out.sort((a, b) => a - b);
  }
}

/**
 * Moves the crease point (the last) of every lower row whose station the
 * upper panel lacks onto the upper panel's edge there, so the two panels
 * share that edge with no gap; the move is TOLERANCE at most.
 */
export function snapCrease(lowerRows: Vec3[][], lower: readonly number[], upperRows: Vec3[][], upper: readonly number[]): void {
  lower.forEach((x, i) => {
    const j = bracket(upper, x);
    if (j < 0) return;
    const row = lowerRows[i];
    row[row.length - 1] = lerp(upperRows[j][0], upperRows[j + 1][0], (x - upper[j]) / (upper[j + 1] - upper[j]));
  });
}
