/**
 * A uniform grid over line segments, used for ray casts against the track
 * edges. Rays walk the grid cell by cell (Amanatides and Woo), so a cast only
 * tests the few segments near its path.
 */
export class SegmentGrid {
  readonly cell: number;
  readonly minX: number;
  readonly minY: number;
  readonly cols: number;
  readonly rows: number;
  /** x1, y1, x2, y2 for each segment. */
  readonly seg: Float64Array;
  private readonly cellStart: Int32Array;
  private readonly cellItems: Int32Array;
  private readonly stamp: Int32Array;
  private stampId = 0;

  constructor(segments: Float64Array, cell = 8) {
    this.seg = segments;
    this.cell = cell;
    const count = segments.length / 4;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < segments.length; i += 2) {
      minX = Math.min(minX, segments[i]);
      maxX = Math.max(maxX, segments[i]);
      minY = Math.min(minY, segments[i + 1]);
      maxY = Math.max(maxY, segments[i + 1]);
    }
    this.minX = minX - cell;
    this.minY = minY - cell;
    this.cols = Math.ceil((maxX - this.minX + cell) / cell);
    this.rows = Math.ceil((maxY - this.minY + cell) / cell);
    const buckets: number[][] = Array.from({ length: this.cols * this.rows }, () => []);
    for (let s = 0; s < count; s++) {
      const o = s * 4;
      const c0 = Math.floor((Math.min(segments[o], segments[o + 2]) - this.minX) / cell);
      const c1 = Math.floor((Math.max(segments[o], segments[o + 2]) - this.minX) / cell);
      const r0 = Math.floor((Math.min(segments[o + 1], segments[o + 3]) - this.minY) / cell);
      const r1 = Math.floor((Math.max(segments[o + 1], segments[o + 3]) - this.minY) / cell);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) buckets[r * this.cols + c].push(s);
    }
    this.cellStart = new Int32Array(buckets.length + 1);
    const items: number[] = [];
    buckets.forEach((b, i) => {
      this.cellStart[i] = items.length;
      items.push(...b);
    });
    this.cellStart[buckets.length] = items.length;
    this.cellItems = Int32Array.from(items);
    this.stamp = new Int32Array(count);
  }

  /** Distance to the first segment hit along (dx, dy), or maxLen if nothing is hit. */
  raycast(ox: number, oy: number, dx: number, dy: number, maxLen: number): number {
    const { cell, cols, rows, seg } = this;
    const id = ++this.stampId;
    let cx = Math.floor((ox - this.minX) / cell);
    let cy = Math.floor((oy - this.minY) / cell);
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const invX = dx !== 0 ? 1 / Math.abs(dx) : Infinity;
    const invY = dy !== 0 ? 1 / Math.abs(dy) : Infinity;
    const fx = (ox - this.minX) / cell - cx;
    const fy = (oy - this.minY) / cell - cy;
    let tMaxX = (dx > 0 ? 1 - fx : fx) * cell * invX;
    let tMaxY = (dy > 0 ? 1 - fy : fy) * cell * invY;
    const tDeltaX = cell * invX;
    const tDeltaY = cell * invY;
    let best = maxLen;
    let tCell = 0;
    while (tCell <= best && cx >= 0 && cy >= 0 && cx < cols && cy < rows) {
      const ci = cy * cols + cx;
      for (let k = this.cellStart[ci], end = this.cellStart[ci + 1]; k < end; k++) {
        const s = this.cellItems[k];
        if (this.stamp[s] === id) continue;
        this.stamp[s] = id;
        const o = s * 4;
        const t = raySegment(ox, oy, dx, dy, seg[o], seg[o + 1], seg[o + 2], seg[o + 3]);
        if (t < best) best = t;
      }
      if (tMaxX < tMaxY) {
        tCell = tMaxX;
        tMaxX += tDeltaX;
        cx += stepX;
      } else {
        tCell = tMaxY;
        tMaxY += tDeltaY;
        cy += stepY;
      }
    }
    return best;
  }
}

/** Ray parameter where (o + t d) crosses segment ab, or Infinity. */
function raySegment(ox: number, oy: number, dx: number, dy: number, ax: number, ay: number, bx: number, by: number): number {
  const ex = bx - ax;
  const ey = by - ay;
  const den = dx * ey - dy * ex;
  if (den === 0) return Infinity;
  const wx = ax - ox;
  const wy = ay - oy;
  const t = (wx * ey - wy * ex) / den;
  const u = (wx * dy - wy * dx) / den;
  return t >= 0 && u >= 0 && u <= 1 ? t : Infinity;
}
