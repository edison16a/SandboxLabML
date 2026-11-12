import type { City } from '@/engine/driving/city/types';
import type { WorldState } from '@/engine/driving/world/state';
import { layoutBuildings } from '../city/buildings/layout';
import { CAR_ROOF } from '../traffic/shapes';
import { sees, sightWorld } from './sightLines';

/** How far round a traffic car the lens keeps clear, m, and how far over its roof it rises when it cannot. */
const MARGIN = 0.8;
const OVER_ROOF = 0.6;

/** Point (px, py) in the frame of traffic car i: along its heading and to its left, m. */
function local(world: WorldState, i: number, px: number, py: number, out: { a: number; b: number }): void {
  const c = Math.cos(world.carHeading[i]);
  const s = Math.sin(world.carHeading[i]);
  const dx = px - world.carX[i];
  const dy = py - world.carY[i];
  out.a = dx * c + dy * s;
  out.b = -dx * s + dy * c;
}

const p = { a: 0, b: 0 };

/**
 * The lowest height the lens at (x, y) may sit at without being inside a
 * traffic car: over the roof of any car whose footprint, plus a margin,
 * it stands over, or 0 when it is clear. Called every frame for the orbit
 * camera; allocation free.
 */
export function lensFloor(world: WorldState | null, x: number, y: number): number {
  if (!world) return 0;
  let floor = 0;
  for (let i = 0; i < world.carCount; i++) {
    const dx = world.carX[i] - x;
    const dy = world.carY[i] - y;
    if (dx * dx + dy * dy > 49) continue;
    local(world, i, x, y, p);
    if (Math.abs(p.a) < world.carLength[i] / 2 + MARGIN && Math.abs(p.b) < world.carWidth[i] / 2 + MARGIN) floor = Math.max(floor, (CAR_ROOF[world.carKind[i]] ?? 1.5) + OVER_ROOF);
  }
  return floor;
}

/** Whether the 2D segment from (ax, ay) to (bx, by) passes over traffic car i's footprint. */
function crossesCar(world: WorldState, i: number, ax: number, ay: number, bx: number, by: number): boolean {
  const steps = 8;
  const hl = world.carLength[i] / 2 + 0.2;
  const hw = world.carWidth[i] / 2 + 0.2;
  for (let k = 1; k < steps; k++) {
    local(world, i, ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps, p);
    if (Math.abs(p.a) < hl && Math.abs(p.b) < hw) return true;
  }
  return false;
}

/**
 * Whether the orbit camera may start at (x, y, h), looking at the
 * followed SUV at (fx, fy): not inside or right next to a traffic car, no
 * car between the lens and the SUV, and no building in the way.
 */
export function clearView(city: City, world: WorldState | null, x: number, y: number, h: number, fx: number, fy: number): boolean {
  if (!sees(sightWorld(city), x, y, h, fx, fy, 0.9)) return false;
  if (!world) return true;
  if (lensFloor(world, x, y) > h) return false;
  for (let i = 0; i < world.carCount; i++) {
    const dx = world.carX[i] - fx;
    const dy = world.carY[i] - fy;
    if (dx * dx + dy * dy < 144 && crossesCar(world, i, x, y, fx, fy)) return false;
  }
  return true;
}

const tallest = new WeakMap<City, Array<{ x: number; y: number; r: number; h: number }>>();

/**
 * Height of the tallest building within `radius` m of (x, y), or 0. The
 * free camera starts above it, so it never opens behind a parapet.
 */
export function tallestNear(city: City, x: number, y: number, radius: number): number {
  let list = tallest.get(city);
  if (!list) {
    list = layoutBuildings(city).buildings.map((b) => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, r: Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2, h: b.height }));
    tallest.set(city, list);
  }
  let top = 0;
  for (const b of list) if (Math.hypot(b.x - x, b.y - y) < radius + b.r) top = Math.max(top, b.h);
  return top;
}
