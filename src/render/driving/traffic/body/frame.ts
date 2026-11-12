import { profile } from '../../suv/geometry/curve';
import type { CarShape, Keys, PlanEnd } from '../shape/types';
import { chord, deg, type Key } from './section';

type Fn = (x: number) => number;

/** A shape's profiles as functions of x, built once per shape. */
interface Profiles {
  sill: Fn;
  trim: Fn;
  waist: Fn;
  shoulder: Fn;
  belt: Fn;
  top: Fn;
  crown: Fn;
  corner: Fn;
  beltIn: Fn;
  sideIn: Fn;
  topIn: Fn;
}

const cache = new WeakMap<CarShape, Profiles>();
const fn = (k: Keys): Fn => (k.length === 1 ? () => k[0][1] : profile(k));

function profilesOf(s: CarShape): Profiles {
  let p = cache.get(s);
  if (!p) {
    p = { sill: fn(s.sill), trim: fn(s.trim), waist: fn(s.waist), shoulder: fn(s.shoulder), belt: fn(s.belt), top: fn(s.top), crown: fn(s.crown), corner: fn(s.corner), beltIn: fn(s.beltIn), sideIn: fn(s.sideIn), topIn: fn(s.topIn) };
    cache.set(s, p);
  }
  return p;
}

/** Wheel centers along x, front then rear. */
export function axles(s: CarShape): [number, number] {
  return [s.wheelbase / 2 + s.axleShift, -s.wheelbase / 2 + s.axleShift];
}

/** Radius of the wheel openings: the tire plus a finger's gap. */
export const archRadius = (s: CarShape) => s.wheelRadius + 0.04;

/** Where an end's superellipse sits: the x its rounding starts at and the tip's x. */
function endSpan(s: CarShape, front: boolean): { end: PlanEnd; from: number; tip: number } {
  const h = s.length / 2;
  const end = front ? s.nose : s.tail;
  return { end, from: front ? h - end.reach : -h + end.reach, tip: front ? h : -h };
}

/** Share of the full half width at x: 1 along the sides, closing to 0 at the tips. */
export function planShare(s: CarShape, x: number): number {
  for (const front of [true, false]) {
    const { end, from, tip } = endSpan(s, front);
    const u = (x - from) / (tip - from);
    if (u > 0) return u >= 1 ? 0 : Math.pow(1 - Math.pow(u, end.square), 1 / end.square);
  }
  return 1;
}

/**
 * Stations through an end's rounding, evenly spaced along its plan
 * outline so the corner gets as many as the face. Returned tip last.
 */
export function endStations(s: CarShape, front: boolean, count: number): number[] {
  const { end, from, tip } = endSpan(s, front);
  const w = s.width / 2;
  const dense: Array<[number, number]> = [];
  for (let i = 0; i <= 64; i++) {
    const phi = (Math.PI / 2) * (1 - i / 64);
    dense.push([from + (tip - from) * Math.pow(Math.cos(phi), 2 / end.square), w * Math.pow(Math.sin(phi), 2 / end.square)]);
  }
  const acc = [0];
  for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const out: number[] = [];
  for (let k = 1; k <= count; k++) {
    const d = (acc[acc.length - 1] * k) / count;
    let j = 0;
    while (j < dense.length - 2 && acc[j + 1] < d) j++;
    const t = (d - acc[j]) / (acc[j + 1] - acc[j] || 1);
    out.push(dense[j][0] + (dense[j + 1][0] - dense[j][0]) * t);
  }
  return out;
}

/**
 * The section keys at x at full width, sill to centerline: sill bottom,
 * trim top, widest point, shoulder crease, belt, rail side, rail top and
 * the centerline. Heights are clamped into order so no profile can fold
 * the skin where two meet near the tips.
 */
export function keysAt(s: CarShape, x: number): Key[] {
  const p = profilesOf(s);
  const w = s.width / 2;
  const top = p.top(x);
  const railTop = top - p.crown(x);
  const railSide = railTop - p.corner(x);
  const belt = Math.min(p.belt(x), railSide - 0.02);
  const shoulder = Math.min(p.shoulder(x), belt - 0.035);
  const waist = Math.min(p.waist(x), shoulder - 0.08);
  const trim = Math.min(p.trim(x), waist - 0.05);
  const sill = Math.min(p.sill(x), trim - 0.03);
  const k = [
    { z: w - 0.085, y: sill, a: deg(-48) },
    { z: w - 0.026, y: trim, a: deg(-10) },
    { z: w, y: waist, a: 0 },
    { z: w - 0.006, y: shoulder, a: deg(5) },
    { z: w - p.beltIn(x), y: belt, a: 0 },
    { z: w - p.sideIn(x), y: railSide, a: 0 },
    { z: w - p.topIn(x), y: railTop, a: 0 },
    { z: 0, y: top, a: deg(90) },
  ];
  // Above the shoulder the outline is one smooth curve: each key takes the mean of its two chords.
  for (let i = 4; i <= 6; i++) k[i].a = (chord(k[i - 1], k[i]) + chord(k[i], k[i + 1])) / 2;
  return k;
}

/** The angle the skin leaves the shoulder crease at: steeper than the chord, so the shoulder rolls over. */
export const shoulderOut = (k: Key[]) => chord(k[3], k[4]) - deg(6);

/**
 * Leans the ends: past the wheels, points above and below an end's lean
 * height tuck back toward the car's middle, so each bumper reads as a
 * rounded nose rather than a cliff. Fades in from the arch to the tip.
 */
export function warpX(s: CarShape, x: number, y: number): number {
  const [front, rear] = axles(s);
  const h = s.length / 2;
  const r = archRadius(s) + 0.05;
  const end = x > 0 ? s.nose : s.tail;
  const start = x > 0 ? front + r : rear - r;
  const tip = x > 0 ? h : -h;
  const t = (x - start) / (tip - start);
  if (t <= 0) return x;
  const f = t >= 1 ? 1 : t * t * (3 - 2 * t);
  const d = (y - end.leanAt) / 0.35;
  // Capped above, so the hood and deck shift back as one instead of folding over the face.
  return x - Math.sign(x) * end.lean * Math.min(d * d, 1.2) * f;
}
