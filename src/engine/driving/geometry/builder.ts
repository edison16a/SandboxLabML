import { Path } from './path';

/**
 * Collects points for a Path from straight runs and circular arcs, each
 * sampled at a fixed spacing. Every road in the city is drawn this way, so
 * lanes and turns meet with matching tangents and no kinks.
 */
export class PathBuilder {
  private xs: number[] = [];
  private ys: number[] = [];

  constructor(private readonly step: number) {}

  /** Starts (or continues) at a point, skipping it if it repeats the last one. */
  moveTo(x: number, y: number): this {
    const n = this.xs.length;
    if (n > 0 && Math.hypot(this.xs[n - 1] - x, this.ys[n - 1] - y) < 1e-6) return this;
    this.xs.push(x);
    this.ys.push(y);
    return this;
  }

  /** A straight run from the last point to (x, y). */
  lineTo(x: number, y: number): this {
    const n = this.xs.length;
    if (n === 0) return this.moveTo(x, y);
    const x0 = this.xs[n - 1];
    const y0 = this.ys[n - 1];
    const len = Math.hypot(x - x0, y - y0);
    const steps = Math.max(1, Math.round(len / this.step));
    for (let i = 1; i <= steps; i++) this.moveTo(x0 + ((x - x0) * i) / steps, y0 + ((y - y0) * i) / steps);
    return this;
  }

  /** An arc about (cx, cy) of radius r from angle a0 to a1 (counterclockwise when a1 > a0). */
  arc(cx: number, cy: number, r: number, a0: number, a1: number): this {
    const steps = Math.max(2, Math.round((Math.abs(a1 - a0) * r) / this.step));
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      this.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    return this;
  }

  build(closed = false): Path {
    // A closed loop that ends on its first point would hold a zero length segment.
    if (closed && this.xs.length > 1) {
      const n = this.xs.length;
      if (Math.hypot(this.xs[0] - this.xs[n - 1], this.ys[0] - this.ys[n - 1]) < 1e-6) {
        this.xs.pop();
        this.ys.pop();
      }
    }
    return new Path(this.xs, this.ys, closed);
  }
}

/**
 * A 90 degree turn from a pose to another: a straight run, an arc of
 * radius `r` tangent to both lines, and a straight run out. The two lines
 * meet at the corner point; the arc is placed so it touches each line `r`
 * meters from that corner. `r` is clipped so the arc never overshoots.
 */
export function quarterTurn(b: PathBuilder, x0: number, y0: number, h0: number, x1: number, y1: number, h1: number, r: number): void {
  const d0x = Math.cos(h0);
  const d0y = Math.sin(h0);
  const d1x = Math.cos(h1);
  const d1y = Math.sin(h1);
  // Corner: where the entry line meets the exit line.
  const den = d0x * d1y - d0y * d1x;
  const t = ((x1 - x0) * d1y - (y1 - y0) * d1x) / den;
  const cx = x0 + d0x * t;
  const cy = y0 + d0y * t;
  const before = Math.hypot(cx - x0, cy - y0);
  const after = Math.hypot(x1 - cx, y1 - cy);
  const radius = Math.min(r, before, after);
  const left = den > 0;
  const ax = cx - d0x * radius;
  const ay = cy - d0y * radius;
  // Arc center sits `radius` to the side of travel from the tangent point.
  const nx = left ? -d0y : d0y;
  const ny = left ? d0x : -d0x;
  const ox = ax + nx * radius;
  const oy = ay + ny * radius;
  const a0 = Math.atan2(ay - oy, ax - ox);
  b.moveTo(x0, y0).lineTo(ax, ay);
  b.arc(ox, oy, radius, a0, a0 + (left ? Math.PI / 2 : -Math.PI / 2));
  b.lineTo(x1, y1);
}
