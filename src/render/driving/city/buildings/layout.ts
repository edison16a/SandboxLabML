import { Rng } from '@/engine/core/rng';
import { SIDEWALK } from '@/engine/driving/city/dimensions';
import type { City } from '@/engine/driving/city/types';

/** Facade styles the shader knows. */
export const STYLE_GLASS = 0;
export const STYLE_BRICK = 1;
export const STYLE_CONCRETE = 2;
export const STYLE_STONE = 3;
export const STYLE_METAL = 4;

/** One building: an axis aligned footprint in sim coordinates, a height and a look. */
export interface BuildingSpec {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  height: number;
  style: number;
  /** 0 to 1, varies colors and which windows are lit. */
  seed: number;
  /** Shops along the ground floor. */
  shops: boolean;
  /** A tower set back above a podium this tall, or 0 for one plain box. */
  podium: number;
  /** Far skyline buildings get no rooftop clutter and no shops. */
  far: boolean;
}

/** Where a block's courtyard is, inside its ring of buildings, for lawns and trees. */
export interface Courtyard {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function pickStyle(rng: Rng, height: number): number {
  if (height > 34) return rng.chance(0.55) ? STYLE_GLASS : rng.chance(0.5) ? STYLE_METAL : STYLE_CONCRETE;
  if (height > 20) return rng.pick([STYLE_CONCRETE, STYLE_STONE, STYLE_GLASS, STYLE_BRICK, STYLE_METAL]);
  return rng.pick([STYLE_BRICK, STYLE_BRICK, STYLE_STONE, STYLE_CONCRETE]);
}

/** Splits a run of `length` meters into frontages of 12 to 26 m. */
function frontages(rng: Rng, length: number): number[] {
  const out: number[] = [];
  let left = length;
  while (left > 30) {
    const w = rng.range(12, 26);
    out.push(w);
    left -= w;
  }
  if (left > 18 || out.length === 0) out.push(left);
  else out[out.length - 1] += left;
  return out;
}

/** Height for a building at distance `r` (0 center to 1 edge) from the middle of downtown. */
function heightAt(rng: Rng, r: number): number {
  const tall = Math.max(0, 1 - r * 1.25);
  const base = 10 + rng.next() * 14;
  const tower = rng.chance(0.25 + tall * 0.5) ? tall * rng.range(18, 52) : 0;
  return Math.round((base + tower) / 3.4) * 3.4 + 1.2;
}

/** Buildings along one side of a lot strip, running from (ax, ay) along +u for `length`, `depth` deep along +v. */
function strip(out: BuildingSpec[], rng: Rng, r: number, ax: number, ay: number, ux: number, uy: number, vx: number, vy: number, length: number, depth: number): void {
  let s = 0;
  for (const w of frontages(rng, length)) {
    const setback = rng.chance(0.7) ? 0 : rng.range(0.8, 2.5);
    const gap = rng.chance(0.6) ? 0 : rng.range(0.6, 1.6);
    const d = depth * rng.range(0.75, 1);
    const p0x = ax + ux * (s + gap / 2) + vx * setback;
    const p0y = ay + uy * (s + gap / 2) + vy * setback;
    const p1x = ax + ux * (s + w - gap / 2) + vx * d;
    const p1y = ay + uy * (s + w - gap / 2) + vy * d;
    s += w;
    if (rng.chance(0.06)) continue;
    const height = heightAt(rng, r);
    const style = pickStyle(rng, height);
    out.push({
      x0: Math.min(p0x, p1x),
      x1: Math.max(p0x, p1x),
      y0: Math.min(p0y, p1y),
      y1: Math.max(p0y, p1y),
      height,
      style,
      seed: rng.next(),
      shops: style !== STYLE_GLASS && style !== STYLE_METAL ? rng.chance(0.75) : rng.chance(0.3),
      podium: height > 30 && rng.chance(0.55) ? Math.round(rng.range(2, 4)) * 4 + 1 : 0,
      far: false,
    });
  }
}

/**
 * The city's buildings, from its seed: every block gets a ring of
 * buildings along its sidewalks with a courtyard inside, taller toward
 * the middle of downtown, and a row lines the outside of the grid. A
 * skyline of plain towers stands further out so the edge of town never
 * shows open ground. Same city, same buildings.
 */
export function layoutBuildings(city: City): { buildings: BuildingSpec[]; courtyards: Courtyard[] } {
  const rng = new Rng(city.spec.seed ^ 0xb11d);
  const out: BuildingSpec[] = [];
  const courtyards: Courtyard[] = [];
  const b = city.bounds;
  const half = Math.max(b.maxX - b.minX, b.maxY - b.minY) / 2;
  for (const k of city.blocks) {
    const x0 = k.x0 + SIDEWALK;
    const x1 = k.x1 - SIDEWALK;
    const y0 = k.y0 + SIDEWALK;
    const y1 = k.y1 - SIDEWALK;
    const r = Math.hypot((x0 + x1) / 2, (y0 + y1) / 2) / half;
    const depth = Math.min(20, Math.min(x1 - x0, y1 - y0) / 2 - 3);
    // South and north rows run the full width; west and east rows fill in between them.
    strip(out, rng, r, x0, y0, 1, 0, 0, 1, x1 - x0, depth);
    strip(out, rng, r, x1, y1, -1, 0, 0, -1, x1 - x0, depth);
    strip(out, rng, r, x0, y1 - depth, 0, -1, 1, 0, y1 - y0 - 2 * depth, depth);
    strip(out, rng, r, x1, y0 + depth, 0, 1, -1, 0, y1 - y0 - 2 * depth, depth);
    courtyards.push({ x0: x0 + depth + 1, x1: x1 - depth - 1, y0: y0 + depth + 1, y1: y1 - depth - 1 });
  }
  // The row facing the grid from outside, its back to the open ground.
  const ox0 = b.minX - SIDEWALK;
  const ox1 = b.maxX + SIDEWALK;
  const oy0 = b.minY - SIDEWALK;
  const oy1 = b.maxY + SIDEWALK;
  const depth = 22;
  strip(out, rng, 1, ox0 - depth, oy0, 1, 0, 0, -1, ox1 - ox0 + 2 * depth, depth);
  strip(out, rng, 1, ox1 + depth, oy1, -1, 0, 0, 1, ox1 - ox0 + 2 * depth, depth);
  strip(out, rng, 1, ox0, oy1, 0, -1, -1, 0, oy1 - oy0, depth);
  strip(out, rng, 1, ox1, oy0, 0, 1, 1, 0, oy1 - oy0, depth);
  skyline(out, rng, ox0 - depth - 40, ox1 + depth + 40, oy0 - depth - 40, oy1 + depth + 40);
  return { buildings: out, courtyards };
}

/** Plain towers in a broken ring well outside the grid, for the horizon. */
function skyline(out: BuildingSpec[], rng: Rng, x0: number, x1: number, y0: number, y1: number): void {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + rng.range(-0.04, 0.04);
    const reach = rng.range(1.05, 1.6);
    const x = cx + Math.cos(a) * ((x1 - x0) / 2) * reach;
    const y = cy + Math.sin(a) * ((y1 - y0) / 2) * reach;
    const w = rng.range(18, 34);
    const d = rng.range(18, 34);
    const height = rng.chance(0.3) ? rng.range(45, 110) : rng.range(18, 45);
    out.push({ x0: x - w / 2, x1: x + w / 2, y0: y - d / 2, y1: y + d / 2, height, style: pickStyle(rng, height), seed: rng.next(), shops: false, podium: 0, far: true });
  }
}
