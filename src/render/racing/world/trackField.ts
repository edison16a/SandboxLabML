import type { Track } from '@/engine/racing/track/types';

/**
 * How far every spot of the landscape is from the road, on a grid in world
 * meters (x, z), plus which spots lie inside the loop. Terrain, scenery and
 * cameras all ask this one field, so nothing grows on the road and the
 * hills always leave the circuit flat.
 */
export interface TrackField {
  minX: number;
  minZ: number;
  cell: number;
  cols: number;
  rows: number;
  /** Distance to the centerline, m. */
  dist: Float32Array;
  /** 1 where the cell center is inside the closed centerline. */
  inside: Uint8Array;
  /** Middle of the track's bounds and the radius that covers it, world meters. */
  centerX: number;
  centerZ: number;
  radius: number;
  /** Half the track's bounds along x and z. */
  extentX: number;
  extentZ: number;
  halfWidth: number;
}

/** How far around each sample the exact distance is stamped; beyond it a chamfer pass fills in. */
const STAMP = 48;

/**
 * Builds the field. Near the road distances are exact (to the nearest 1 m
 * sample); further out a two pass chamfer sweep approximates them within a
 * few percent, which only shapes far hills.
 */
export function buildTrackField(track: Track, margin = 760, cell = 4): TrackField {
  const b = track.bounds;
  const minX = b.minX - margin;
  const minZ = -b.maxY - margin;
  const cols = Math.ceil((b.maxX - b.minX + margin * 2) / cell) + 1;
  const rows = Math.ceil((b.maxY - b.minY + margin * 2) / cell) + 1;
  const dist = new Float32Array(cols * rows).fill(1e9);
  const r = Math.ceil(STAMP / cell);
  for (let i = 0; i < track.count; i++) {
    const px = track.cx[i];
    const pz = -track.cy[i];
    const c0 = Math.round((px - minX) / cell);
    const r0 = Math.round((pz - minZ) / cell);
    for (let rr = Math.max(0, r0 - r); rr <= Math.min(rows - 1, r0 + r); rr++) {
      const z = minZ + rr * cell;
      for (let cc = Math.max(0, c0 - r); cc <= Math.min(cols - 1, c0 + r); cc++) {
        const x = minX + cc * cell;
        const d = Math.hypot(x - px, z - pz);
        const k = rr * cols + cc;
        if (d < dist[k]) dist[k] = d;
      }
    }
  }
  chamfer(dist, cols, rows, cell);
  return {
    minX,
    minZ,
    cell,
    cols,
    rows,
    dist,
    inside: fillInside(track, minX, minZ, cell, cols, rows),
    centerX: (b.minX + b.maxX) / 2,
    centerZ: -(b.minY + b.maxY) / 2,
    radius: Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2,
    extentX: (b.maxX - b.minX) / 2,
    extentZ: (b.maxY - b.minY) / 2,
    halfWidth: track.halfWidth,
  };
}

/** Forward then backward sweep with 8 neighbors: each cell takes the best neighbor plus the step. */
function chamfer(d: Float32Array, cols: number, rows: number, cell: number): void {
  const diag = cell * Math.SQRT2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      let v = d[k];
      if (c > 0) v = Math.min(v, d[k - 1] + cell);
      if (r > 0) {
        v = Math.min(v, d[k - cols] + cell);
        if (c > 0) v = Math.min(v, d[k - cols - 1] + diag);
        if (c < cols - 1) v = Math.min(v, d[k - cols + 1] + diag);
      }
      d[k] = v;
    }
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const k = r * cols + c;
      let v = d[k];
      if (c < cols - 1) v = Math.min(v, d[k + 1] + cell);
      if (r < rows - 1) {
        v = Math.min(v, d[k + cols] + cell);
        if (c < cols - 1) v = Math.min(v, d[k + cols + 1] + diag);
        if (c > 0) v = Math.min(v, d[k + cols - 1] + diag);
      }
      d[k] = v;
    }
  }
}

/** Even-odd scanline fill of the centerline polygon, one row at a time. */
function fillInside(track: Track, minX: number, minZ: number, cell: number, cols: number, rows: number): Uint8Array {
  const out = new Uint8Array(cols * rows);
  const xs: number[] = [];
  for (let r = 0; r < rows; r++) {
    const z = minZ + r * cell;
    xs.length = 0;
    for (let i = 0; i < track.count; i++) {
      const j = (i + 1) % track.count;
      const az = -track.cy[i];
      const bz = -track.cy[j];
      if (az > z === bz > z) continue;
      const t = (z - az) / (bz - az);
      xs.push(track.cx[i] + (track.cx[j] - track.cx[i]) * t);
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - minX) / cell));
      const c1 = Math.min(cols - 1, Math.floor((xs[k + 1] - minX) / cell));
      for (let c = c0; c <= c1; c++) out[r * cols + c] = 1;
    }
  }
  return out;
}

/** Distance to the road at any world point, bilinear inside the grid and a fair guess beyond it. */
export function distanceAt(f: TrackField, x: number, z: number): number {
  const gx = (x - f.minX) / f.cell;
  const gz = (z - f.minZ) / f.cell;
  const cx = Math.min(f.cols - 1.001, Math.max(0, gx));
  const cz = Math.min(f.rows - 1.001, Math.max(0, gz));
  const c = Math.floor(cx);
  const r = Math.floor(cz);
  const tx = cx - c;
  const tz = cz - r;
  const k = r * f.cols + c;
  const d = f.dist;
  const v = (d[k] * (1 - tx) + d[k + 1] * tx) * (1 - tz) + (d[k + f.cols] * (1 - tx) + d[k + f.cols + 1] * tx) * tz;
  // Outside the grid, add how far past its edge the point is.
  return v + Math.hypot((gx - cx) * f.cell, (gz - cz) * f.cell);
}

/** True when the point lies inside the circuit's loop (the infield). */
export function insideAt(f: TrackField, x: number, z: number): boolean {
  const c = Math.round((x - f.minX) / f.cell);
  const r = Math.round((z - f.minZ) / f.cell);
  if (c < 0 || r < 0 || c >= f.cols || r >= f.rows) return false;
  return f.inside[r * f.cols + c] === 1;
}
