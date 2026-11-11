import type { DistanceField } from './field';

/** How many rings of cells the fallback searches for an open one, when every corner round a point is blocked. */
const SEARCH_RINGS = 6;

/** Scratch for the nearest open cell, so sampling allocates nothing. */
const near = { cell: -1, x: 0, z: 0 };

/**
 * Nearest open cell to (x, z), searched ring by ring. An agent hugging a
 * wall stands inside the field's safety margin, where every cell is
 * blocked, so its distance and flow come from the closest cell it could
 * stand on. Returns false when none is near.
 */
function nearestOpen(f: DistanceField, x: number, z: number): boolean {
  const ci = Math.round((x - f.x0) / f.cell);
  const cj = Math.round((z - f.z0) / f.cell);
  let bestD = Infinity;
  near.cell = -1;
  for (let r = 0; r <= SEARCH_RINGS; r++) {
    for (let j = cj - r; j <= cj + r; j++) {
      for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || i < 0 || j < 0 || i >= f.nx || j >= f.nz) continue;
        const c = j * f.nx + i;
        if (!Number.isFinite(f.dist[c])) continue;
        const px = f.x0 + i * f.cell;
        const pz = f.z0 + j * f.cell;
        const d = Math.hypot(px - x, pz - z);
        if (d < bestD) {
          bestD = d;
          near.cell = c;
          near.x = px;
          near.z = pz;
        }
      }
    }
    // A ring further out can only be further away than one already found.
    if (near.cell >= 0 && bestD <= r * f.cell) break;
  }
  return near.cell >= 0;
}

/**
 * Walking distance from (x, z) to the finish, m: a blend of the four cells
 * round the point, skipping blocked ones, so it changes smoothly as an
 * agent moves. Infinity only where no open cell is anywhere near.
 */
export function sampleDistance(f: DistanceField, x: number, z: number): number {
  const u = (x - f.x0) / f.cell;
  const v = (z - f.z0) / f.cell;
  const i0 = Math.floor(u);
  const j0 = Math.floor(v);
  const fu = u - i0;
  const fv = v - j0;
  let sum = 0;
  let weight = 0;
  for (let k = 0; k < 4; k++) {
    const i = i0 + (k & 1);
    const j = j0 + (k >> 1);
    if (i < 0 || j < 0 || i >= f.nx || j >= f.nz) continue;
    const d = f.dist[j * f.nx + i];
    if (!Number.isFinite(d)) continue;
    const w = (k & 1 ? fu : 1 - fu) * (k >> 1 ? fv : 1 - fv);
    sum += d * w;
    weight += w;
  }
  if (weight > 1e-4) return sum / weight;
  if (!nearestOpen(f, x, z)) return Infinity;
  return f.dist[near.cell] + Math.hypot(near.x - x, near.z - z);
}

/**
 * The direction to walk from (x, z), as a unit vector in `out`: the four
 * cells' flows blended like sampleDistance. Returns false when there is
 * no open cell near (out is then +x, toward the finish).
 */
export function sampleFlow(f: DistanceField, x: number, z: number, out: { x: number; z: number }): boolean {
  const u = (x - f.x0) / f.cell;
  const v = (z - f.z0) / f.cell;
  const i0 = Math.floor(u);
  const j0 = Math.floor(v);
  const fu = u - i0;
  const fv = v - j0;
  let fx = 0;
  let fz = 0;
  let weight = 0;
  for (let k = 0; k < 4; k++) {
    const i = i0 + (k & 1);
    const j = j0 + (k >> 1);
    if (i < 0 || j < 0 || i >= f.nx || j >= f.nz) continue;
    const c = j * f.nx + i;
    if (!Number.isFinite(f.dist[c])) continue;
    const w = (k & 1 ? fu : 1 - fu) * (k >> 1 ? fv : 1 - fv);
    fx += f.flowX[c] * w;
    fz += f.flowZ[c] * w;
    weight += w;
  }
  if (weight <= 1e-4) {
    if (!nearestOpen(f, x, z)) {
      out.x = 1;
      out.z = 0;
      return false;
    }
    // Step toward the open cell first, then along its flow, so an agent pinned in the margin eases back out.
    const dx = near.x - x;
    const dz = near.z - z;
    const d = Math.hypot(dx, dz);
    fx = f.flowX[near.cell] + (d > 1e-6 ? dx / d : 0) * 0.5;
    fz = f.flowZ[near.cell] + (d > 1e-6 ? dz / d : 0) * 0.5;
  }
  const len = Math.hypot(fx, fz);
  if (len < 1e-6) {
    out.x = 1;
    out.z = 0;
    return true;
  }
  out.x = fx / len;
  out.z = fz / len;
  return true;
}
