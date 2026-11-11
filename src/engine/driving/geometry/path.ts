/**
 * A sampled polyline with arc length, unit tangent and signed curvature at
 * every sample. Lanes, turn connectors, routes and sidewalk loops are all
 * Paths, so every lane relative query (where am I, how far along, how
 * sharp is the road ahead) is one fast lookup on typed arrays.
 */
export class Path {
  readonly n: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** Arc length at each sample, m. */
  readonly s: Float64Array;
  readonly tx: Float64Array;
  readonly ty: Float64Array;
  /** Signed curvature, 1/m, positive when the path bends left. */
  readonly k: Float64Array;
  readonly length: number;
  readonly closed: boolean;

  constructor(xs: ArrayLike<number>, ys: ArrayLike<number>, closed = false) {
    const n = xs.length;
    this.n = n;
    this.closed = closed;
    this.x = Float64Array.from(xs);
    this.y = Float64Array.from(ys);
    this.s = new Float64Array(n);
    this.tx = new Float64Array(n);
    this.ty = new Float64Array(n);
    this.k = new Float64Array(n);
    for (let i = 1; i < n; i++) this.s[i] = this.s[i - 1] + Math.hypot(this.x[i] - this.x[i - 1], this.y[i] - this.y[i - 1]);
    this.length = this.s[n - 1] + (closed ? Math.hypot(this.x[0] - this.x[n - 1], this.y[0] - this.y[n - 1]) : 0);
    for (let i = 0; i < n; i++) {
      const a = this.neighbor(i, -1);
      const b = this.neighbor(i, 1);
      const dx = this.x[b] - this.x[a];
      const dy = this.y[b] - this.y[a];
      const len = Math.hypot(dx, dy) || 1;
      this.tx[i] = dx / len;
      this.ty[i] = dy / len;
    }
    // Curvature from the turn of the tangent across neighbors, divided by the distance between them.
    for (let i = 0; i < n; i++) {
      const a = this.neighbor(i, -1);
      const b = this.neighbor(i, 1);
      const cross = this.tx[a] * this.ty[b] - this.ty[a] * this.tx[b];
      const dot = this.tx[a] * this.tx[b] + this.ty[a] * this.ty[b];
      const ds = Math.hypot(this.x[b] - this.x[a], this.y[b] - this.y[a]) || 1;
      this.k[i] = Math.atan2(cross, dot) / ds;
    }
  }

  private neighbor(i: number, step: 1 | -1): number {
    const j = i + step;
    if (this.closed) return (j + this.n) % this.n;
    return j < 0 ? 0 : j >= this.n ? this.n - 1 : j;
  }

  /** Sample index at or just before arc length `s`, clamped (or wrapped on a closed path). */
  indexAt(s: number, hint = 0): number {
    let d = s;
    if (this.closed) d = ((s % this.length) + this.length) % this.length;
    if (d <= 0) return 0;
    if (d >= this.s[this.n - 1]) return this.n - 1;
    let i = hint > 0 && hint < this.n && this.s[hint] <= d ? hint : 0;
    while (i < this.n - 2 && this.s[i + 1] <= d) i++;
    return i;
  }

  /** Position and tangent at arc length `s`, linearly between samples. Writes into `out`, allocates nothing. */
  sample(s: number, out: PathPoint, hint = 0): PathPoint {
    let d = s;
    if (this.closed) d = ((s % this.length) + this.length) % this.length;
    const i = this.indexAt(d, hint);
    const j = this.closed ? (i + 1) % this.n : Math.min(i + 1, this.n - 1);
    const span = (j > i ? this.s[j] : this.length) - this.s[i];
    const t = span > 1e-9 ? Math.min(1, Math.max(0, (d - this.s[i]) / span)) : 0;
    out.x = this.x[i] + (this.x[j] - this.x[i]) * t;
    out.y = this.y[i] + (this.y[j] - this.y[i]) * t;
    out.tx = this.tx[i] + (this.tx[j] - this.tx[i]) * t;
    out.ty = this.ty[i] + (this.ty[j] - this.ty[i]) * t;
    const len = Math.hypot(out.tx, out.ty) || 1;
    out.tx /= len;
    out.ty /= len;
    out.k = this.k[i] + (this.k[j] - this.k[i]) * t;
    out.index = i;
    return out;
  }

  /**
   * Projects (px, py) onto the path, searching `window` samples either side
   * of `hint`. Gives the arc length, the signed lateral offset (positive to
   * the left of travel) and the nearest index. Allocation free.
   */
  project(px: number, py: number, hint: number, window: number, out: Projection): Projection {
    const lo = this.closed ? hint - window : Math.max(0, hint - window);
    const hi = this.closed ? hint + window : Math.min(this.n - 1, hint + window);
    let best = hint;
    let bestD = Infinity;
    for (let w = lo; w <= hi; w++) {
      const i = this.closed ? ((w % this.n) + this.n) % this.n : w;
      const dx = px - this.x[i];
      const dy = py - this.y[i];
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    // Refine on whichever neighboring segment the point falls on: ahead of the sample or behind it.
    let s = this.s[best];
    let lateral = (px - this.x[best]) * -this.ty[best] + (py - this.y[best]) * this.tx[best];
    const ahead = (px - this.x[best]) * this.tx[best] + (py - this.y[best]) * this.ty[best] >= 0;
    const other = ahead ? this.neighbor(best, 1) : this.neighbor(best, -1);
    const first = ahead ? best : other;
    const second = ahead ? other : best;
    const sx = this.x[second] - this.x[first];
    const sy = this.y[second] - this.y[first];
    const seg = Math.hypot(sx, sy);
    if (first !== second && seg > 1e-9) {
      const ux = sx / seg;
      const uy = sy / seg;
      const t = Math.min(seg, Math.max(0, (px - this.x[first]) * ux + (py - this.y[first]) * uy));
      s = this.s[first] + t;
      lateral = (px - this.x[first]) * -uy + (py - this.y[first]) * ux;
    }
    out.s = s;
    out.lateral = lateral;
    out.index = best;
    out.distance = Math.sqrt(bestD);
    return out;
  }
}

export interface PathPoint {
  x: number;
  y: number;
  tx: number;
  ty: number;
  k: number;
  index: number;
}

export interface Projection {
  s: number;
  lateral: number;
  index: number;
  /** Distance to the nearest sample, m. */
  distance: number;
}

export function pathPoint(): PathPoint {
  return { x: 0, y: 0, tx: 1, ty: 0, k: 0, index: 0 };
}

export function projection(): Projection {
  return { s: 0, lateral: 0, index: 0, distance: 0 };
}
