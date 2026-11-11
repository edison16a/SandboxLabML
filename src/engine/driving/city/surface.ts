import { CURB_RADIUS } from './dimensions';
import type { City, CityBlock } from './types';

/** Index of the cell between street lines that holds v: lines[i] <= v < lines[i + 1], clamped to the grid. */
export function cellOf(lines: Float64Array, v: number): number {
  const last = lines.length - 2;
  for (let i = 0; i < last; i++) if (v < lines[i + 1]) return i;
  return last;
}

/**
 * Whether a ground point is on the road surface (inside the curbs). The
 * blocks are rounded rectangles and the city ends at the outer curbs, so
 * this is a couple of comparisons and at most one distance check.
 */
export function isOnRoad(city: City, x: number, y: number): boolean {
  const b = city.bounds;
  if (x <= b.minX || x >= b.maxX || y <= b.minY || y >= b.maxY) return false;
  const i = cellOf(city.xs, x);
  const j = cellOf(city.ys, y);
  const block = city.blocks[j * (city.xs.length - 1) + i];
  if (x <= block.x0 || x >= block.x1 || y <= block.y0 || y >= block.y1) return true;
  // Inside the block's square outline: only the rounded corner cut outs are road.
  const R = CURB_RADIUS;
  const cx = x < block.x0 + R ? block.x0 + R : x > block.x1 - R ? block.x1 - R : x;
  const cy = y < block.y0 + R ? block.y0 + R : y > block.y1 - R ? block.y1 - R : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy > R * R;
}

/** Distance along a ray to an axis aligned box, or Infinity when it misses. */
function rayBox(ox: number, oy: number, ix: number, iy: number, x0: number, x1: number, y0: number, y1: number): number {
  const ta = (x0 - ox) * ix;
  const tb = (x1 - ox) * ix;
  const ua = (y0 - oy) * iy;
  const ub = (y1 - oy) * iy;
  const t0 = ta < tb ? ta : tb;
  const t1 = ta < tb ? tb : ta;
  const u0 = ua < ub ? ua : ub;
  const u1 = ua < ub ? ub : ua;
  const enter = t0 > u0 ? t0 : u0;
  const exit = t1 < u1 ? t1 : u1;
  if (exit < 0 || enter > exit) return Infinity;
  return enter > 0 ? enter : 0;
}

/** Distance along a unit ray to a circle, or Infinity. */
export function rayCircle(ox: number, oy: number, dx: number, dy: number, cx: number, cy: number, r: number): number {
  const fx = ox - cx;
  const fy = oy - cy;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const disc = b * b - c;
  if (disc < 0 || b > 0) return Infinity;
  return -b - Math.sqrt(disc);
}

/** Distance along a unit ray to a block's rounded outline: two crossed boxes and four corner circles. */
function rayBlock(ox: number, oy: number, dx: number, dy: number, ix: number, iy: number, k: CityBlock): number {
  const R = CURB_RADIUS;
  let t = rayBox(ox, oy, ix, iy, k.x0, k.x1, k.y0 + R, k.y1 - R);
  const t2 = rayBox(ox, oy, ix, iy, k.x0 + R, k.x1 - R, k.y0, k.y1);
  if (t2 < t) t = t2;
  for (let c = 0; c < 4; c++) {
    const cx = c & 1 ? k.x1 - R : k.x0 + R;
    const cy = c & 2 ? k.y1 - R : k.y0 + R;
    const tc = rayCircle(ox, oy, dx, dy, cx, cy, R);
    if (tc < t) t = tc;
  }
  return t;
}

/**
 * Distance from (ox, oy) along the unit direction (dx, dy) to the first
 * curb, up to `range`. It walks the street grid cell by cell and tests only
 * the block in each cell it crosses, so a 40 m ray touches two or three
 * blocks. The city's outer curb counts too. Allocation free.
 */
export function castStatic(city: City, ox: number, oy: number, dx: number, dy: number, range: number): number {
  const b = city.bounds;
  if (!(ox > b.minX && ox < b.maxX && oy > b.minY && oy < b.maxY)) return 0;
  const ix = dx !== 0 ? 1 / dx : 1e12;
  const iy = dy !== 0 ? 1 / dy : 1e12;
  // Leaving through the outer curb.
  const tx = dx > 0 ? (b.maxX - ox) * ix : dx < 0 ? (b.minX - ox) * ix : Infinity;
  const ty = dy > 0 ? (b.maxY - oy) * iy : dy < 0 ? (b.minY - oy) * iy : Infinity;
  let best = Math.min(range, tx, ty);
  const nx = city.xs.length - 1;
  let i = cellOf(city.xs, ox);
  let j = cellOf(city.ys, oy);
  let t = 0;
  while (t < best) {
    const hit = rayBlock(ox, oy, dx, dy, ix, iy, city.blocks[j * nx + i]);
    if (hit < best) best = hit;
    // Step to whichever cell wall the ray reaches first.
    const nextX = dx > 0 ? (i + 1 <= nx - 1 ? (city.xs[i + 1] - ox) * ix : Infinity) : dx < 0 ? (i - 1 >= 0 ? (city.xs[i] - ox) * ix : Infinity) : Infinity;
    const nextY = dy > 0 ? (j + 1 <= city.ys.length - 2 ? (city.ys[j + 1] - oy) * iy : Infinity) : dy < 0 ? (j - 1 >= 0 ? (city.ys[j] - oy) * iy : Infinity) : Infinity;
    if (nextX === Infinity && nextY === Infinity) break;
    if (nextX < nextY) {
      t = nextX;
      i += dx > 0 ? 1 : -1;
    } else {
      t = nextY;
      j += dy > 0 ? 1 : -1;
    }
  }
  return best < range ? best : range;
}
