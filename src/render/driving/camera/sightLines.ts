import { SIDEWALK } from '@/engine/driving/city/dimensions';
import type { City } from '@/engine/driving/city/types';
import { HEAD_HEIGHT, NEAR_HEIGHT, streetscapeFor } from '../city/streetscape/layout';

/**
 * Something a camera's sight line can run into: a vertical cylinder of
 * radius `r` from `bottom` to `top` m. Poles, lamps and trunks reach the
 * ground; a signal head or a tree crown hangs in the air.
 */
interface Obstacle {
  x: number;
  y: number;
  r: number;
  bottom: number;
  top: number;
}

/** Street furniture and building blocks of one city, as the sight checks see them. */
export interface SightWorld {
  obstacles: Obstacle[];
  /** Block footprints inside the sidewalks: buildings stand all round them, taller than any camera here. */
  blocks: Array<{ x0: number; x1: number; y0: number; y1: number }>;
}

const worlds = new WeakMap<City, SightWorld>();

/** How far from the lens the clutter margin of `sees` reaches, m. */
const CLUTTER_REACH = 14;

/** The sight world of a city, built once and kept. */
export function sightWorld(city: City): SightWorld {
  let w = worlds.get(city);
  if (w) return w;
  const s = streetscapeFor(city);
  const obstacles: Obstacle[] = [];
  const add = (p: { x: number; y: number }, r: number, bottom: number, top: number) => obstacles.push({ x: p.x, y: p.y, r, bottom, top });
  for (const g of s.signals) {
    add(g.pole, 0.3, 0, HEAD_HEIGHT + 0.6);
    add(g.near, 0.45, NEAR_HEIGHT - 0.6, NEAR_HEIGHT + 0.6);
    add(g.head, 0.55, HEAD_HEIGHT - 0.7, HEAD_HEIGHT + 0.6);
    // The mast arm from the pole out to the head over the lane.
    for (let t = 0.25; t < 1; t += 0.25) add({ x: g.pole.x + (g.head.x - g.pole.x) * t, y: g.pole.y + (g.head.y - g.pole.y) * t }, 0.25, HEAD_HEIGHT - 0.2, HEAD_HEIGHT + 0.5);
  }
  for (const p of s.walks) add(p, 0.25, 0, 3);
  for (const p of s.lamps) add(p, 0.25, 0, 7);
  for (const p of s.trees) {
    add(p, 0.25, 0, 2.6);
    add(p, 1.7, 2.4, 7.5);
  }
  const blocks = city.blocks.map((b) => ({ x0: b.x0 + SIDEWALK, x1: b.x1 - SIDEWALK, y0: b.y0 + SIDEWALK, y1: b.y1 - SIDEWALK }));
  w = { obstacles, blocks };
  worlds.set(city, w);
  return w;
}

/** Narrows [t0, t1] to where one coordinate of the segment lies inside [lo, hi]; empty when it never does. */
function slab(p: number, d: number, lo: number, hi: number, span: { t0: number; t1: number }): boolean {
  if (Math.abs(d) < 1e-9) return p >= lo && p <= hi;
  let ta = (lo - p) / d;
  let tb = (hi - p) / d;
  if (ta > tb) {
    const swap = ta;
    ta = tb;
    tb = swap;
  }
  span.t0 = Math.max(span.t0, ta);
  span.t1 = Math.min(span.t1, tb);
  return span.t0 <= span.t1;
}

const span = { t0: 0, t1: 1 };

/** Whether the 2D segment from a to b crosses the box (slab test). Allocation free. */
function crossesBox(ax: number, ay: number, bx: number, by: number, b: SightWorld['blocks'][number]): boolean {
  span.t0 = 0;
  span.t1 = 1;
  return slab(ax, bx - ax, b.x0, b.x1, span) && slab(ay, by - ay, b.y0, b.y1, span);
}

/**
 * Whether the camera at (ax, ay, ah) sees the point (bx, by, bh) past the
 * street furniture and the buildings, in sim meters. The first and last
 * few percent of the line are forgiven: the lens itself and the car's own
 * surroundings never count as blocking it. `clutter` widens what counts
 * near the lens, by up to that many meters at the lens and none past
 * CLUTTER_REACH: a trunk or crown that only grazes the line close by still
 * fills half the frame. Plain loops over plain arrays, cheap enough to run
 * every few frames.
 */
export function sees(w: SightWorld, ax: number, ay: number, ah: number, bx: number, by: number, bh: number, clutter = 0): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const len = Math.sqrt(len2);
  for (let i = 0; i < w.obstacles.length; i++) {
    const o = w.obstacles[i];
    const t = ((o.x - ax) * dx + (o.y - ay) * dy) / len2;
    if (t < 0.04 || t > 0.96) continue;
    const h = ah + (bh - ah) * t;
    if (h < o.bottom || h > o.top) continue;
    const ex = ax + dx * t - o.x;
    const ey = ay + dy * t - o.y;
    const r = o.r + clutter * Math.max(0, 1 - (t * len) / CLUTTER_REACH);
    if (ex * ex + ey * ey < r * r) return false;
  }
  for (let i = 0; i < w.blocks.length; i++) if (crossesBox(ax, ay, bx, by, w.blocks[i])) return false;
  return true;
}

/**
 * How close a piece of furniture at lens height may stand before it fills
 * the frame as the camera pans, m: a signal head looms much larger than a
 * pole. Only what reaches within 1.5 m of the lens height counts.
 */
const CLEAR_POLE = 2.6;
const CLEAR_HEAD = 4.5;

/** True when something stands so close to the lens, at its height, that it would fill the frame. */
export function crowdedLens(w: SightWorld, x: number, y: number, h: number): boolean {
  for (const o of w.obstacles) {
    if (o.top < h - 1.5 || o.bottom > h + 1.5) continue;
    const reach = (o.bottom > 1 ? CLEAR_HEAD : CLEAR_POLE) + o.r;
    if ((o.x - x) ** 2 + (o.y - y) ** 2 < reach * reach) return true;
  }
  return false;
}
