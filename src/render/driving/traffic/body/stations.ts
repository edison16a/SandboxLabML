import type { CarShape } from '../shape/types';
import type { TrafficDetail } from './detail';
import { archRadius, axles, endSpan, keysAt } from './frame';

/** How far outside each wheel opening its straight sides stand, m. */
export const ARCH_EDGE = 0.003;

/** How much a radian of turn counts against a meter of length when spacing stations. */
const TURN_WEIGHT = 0.35;
/** The same along the middle, where the turns are the side view's: hood into glass, glass into roof. */
const SIDE_TURN_WEIGHT = 0.9;

/** n stations spread evenly by accumulated measure over dense samples `xs` with running totals `acc`, first excluded. */
function spread(xs: number[], acc: number[], n: number): number[] {
  const out: number[] = [];
  const total = acc[acc.length - 1];
  let j = 0;
  for (let k = 1; k <= n; k++) {
    const d = (total * k) / n;
    while (j < xs.length - 2 && acc[j + 1] < d) j++;
    const t = (d - acc[j]) / (acc[j + 1] - acc[j] || 1);
    out.push(xs[j] + (xs[j + 1] - xs[j]) * t);
  }
  return out;
}

/**
 * Stations through an end's rounding, spaced by the plan outline's length
 * plus its turning, so the tight corner gets more of them than the flat
 * face: each step then turns the surface by about as much, and the
 * corner's reflections stay smooth. Returned tip last.
 */
export function endStations(s: CarShape, front: boolean, count: number): number[] {
  const { end, from, tip } = endSpan(s, front);
  const w = s.width / 2;
  const dense: Array<[number, number]> = [];
  for (let i = 0; i <= 96; i++) {
    const phi = (Math.PI / 2) * (1 - i / 96);
    dense.push([from + (tip - from) * Math.pow(Math.cos(phi), 2 / end.square), w * Math.pow(Math.sin(phi), 2 / end.square)]);
  }
  const seg = (i: number) => [dense[i + 1][0] - dense[i][0], dense[i + 1][1] - dense[i][1]];
  const acc = [0];
  for (let i = 1; i < dense.length; i++) {
    const [ax, az] = seg(i - 1);
    const len = Math.hypot(ax, az);
    let turn = 0;
    if (i < dense.length - 1) {
      const [bx, bz] = seg(i);
      turn = Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / (len * Math.hypot(bx, bz) || 1))));
    }
    acc.push(acc[i - 1] + len + TURN_WEIGHT * turn);
  }
  return spread(dense.map((p) => p[0]), acc, count);
}

/**
 * Stations along the middle, between the ends' roundings, spaced by
 * length plus how sharply the side view turns there: where the hood folds
 * into the windshield and the glass rolls onto the roof, stations crowd
 * in so the silhouette stays round, and a long flat roof gets few. The
 * count is the tier's, so a long van costs no more than a hatchback.
 */
export function middleStations(s: CarShape, n: number): number[] {
  const h = s.length / 2;
  const rear = -h + s.tail.reach;
  const front = h - s.nose.reach;
  const xs: number[] = [];
  for (let i = 0; i <= 160; i++) xs.push(rear + ((front - rear) * i) / 160);
  const slope = (x: number, key: number) => {
    const e = 0.01;
    return Math.atan2(keysAt(s, x + e)[key].y - keysAt(s, x - e)[key].y, 2 * e);
  };
  const angles = xs.map((x) => [slope(x, 7), slope(x, 4)]);
  const acc = [0];
  for (let i = 1; i < xs.length; i++) {
    const turn = Math.abs(angles[i][0] - angles[i - 1][0]) + 0.5 * Math.abs(angles[i][1] - angles[i - 1][1]);
    acc.push(acc[i - 1] + (xs[i] - xs[i - 1]) + SIDE_TURN_WEIGHT * turn);
  }
  return [rear, ...spread(xs, acc, n)];
}

/** Every station of the panels above the shoulder, tail to nose: the tail's rounding, the middle, the nose's. */
export function upperStations(s: CarShape, d: TrafficDetail): number[] {
  return [...endStations(s, false, d.ends).reverse(), ...middleStations(s, d.middle), ...endStations(s, true, d.ends)];
}

/**
 * The lower panels' stations: the upper ones (so the shoulder crease is
 * shared) plus a row across every wheel opening and one just outside each
 * edge, so each opening is round and its sides stand straight.
 */
export function lowerStations(s: CarShape, d: TrafficDetail): number[] {
  const r = archRadius(s);
  const out = upperStations(s, d);
  const extra: number[] = [];
  for (const axle of axles(s)) {
    extra.push(axle - r - ARCH_EDGE, axle + r + ARCH_EDGE);
    for (let i = 0; i <= d.arch; i++) extra.push(axle - r * Math.cos((Math.PI * i) / d.arch));
  }
  for (const x of extra) if (out.every((k) => Math.abs(k - x) > 0.002)) out.push(x);
  return out.sort((a, b) => a - b);
}
