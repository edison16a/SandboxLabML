import { RUNOFF } from '@/engine/racing/car/runtime';
import { terrainHeight } from '../world/terrain/terrainHeight';
import { distanceAt } from '../world/trackField';
import type { WorldData } from '../world/worldData';
import { padWeight } from '../stadium/layout';

/** A trackside camera: where it stands (world), and how far along the road it covers. */
export interface Station {
  x: number;
  y: number;
  z: number;
  s: number;
}

/** Spacing between stations along the road, m. */
const EVERY = 95;

/**
 * Camera positions round the circuit, like a TV crew's: every 95 m or so,
 * just past the wall on alternating sides, on a few meters of tower. Each
 * spot is kept clear of every part of the road and of the buildings, so a
 * camera never stands on the track or inside a grandstand.
 */
export function trackStations(world: WorldData): Station[] {
  const { track, field, shape, layout } = world;
  const out: Station[] = [];
  const clear = track.halfWidth + RUNOFF + 3.5;
  const step = Math.max(1, Math.round(EVERY / track.spacing));
  let flip = 1;
  for (let i = 0; i < track.count; i += step) {
    // Prefer the outside of the bend, where the car swings toward the lens.
    const bend = Math.sign(track.curvature[(i + Math.round(25 / track.spacing)) % track.count]) || flip;
    flip = -flip;
    for (const side of [-bend, bend]) {
      const lat = side * (track.halfWidth + RUNOFF + 6.5);
      const x = track.cx[i] - track.ty[i] * lat;
      const z = -(track.cy[i] + track.tx[i] * lat);
      // Well clear of the buildings too: their fence and roofs would sit between the lens and the car.
      if (distanceAt(field, x, z) < clear || layout.pads.some((p) => padWeight(p, x, z, 24) > 0)) continue;
      out.push({ x, y: terrainHeight(shape, x, z) + 4.5 + (out.length % 3) * 1.2, z, s: track.s[i] });
      break;
    }
  }
  return out;
}

/** Road distance from a to b going forward round a loop of length `len`. */
export function ahead(a: number, b: number, len: number): number {
  return (((b - a) % len) + len) % len;
}

/**
 * Picks the station to watch from: the current one until the car is 35 m
 * past it, then the next one down the road. After a jump (a new car or a
 * new lap from the grid) it picks the first station ahead of the car.
 */
export function pickStation(stations: Station[], current: number, carS: number, len: number): number {
  if (!stations.length) return -1;
  if (current >= 0 && current < stations.length) {
    const past = ahead(stations[current].s, carS, len);
    if (past < 35) return current;
    if (past < 160) return (current + 1) % stations.length;
  }
  let best = 0;
  let bestGap = Infinity;
  stations.forEach((st, k) => {
    const gap = ahead(carS, st.s, len);
    const score = gap < 15 ? gap + len : gap;
    if (score < bestGap) {
      bestGap = score;
      best = k;
    }
  });
  return best;
}
