import { RUNOFF } from '@/engine/racing/car/runtime';
import { terrainHeight } from '../world/terrain/terrainHeight';
import { distanceAt } from '../world/trackField';
import type { WorldData } from '../world/worldData';
import { padOf, padWeight, type StadiumLayout } from '../stadium/layout';

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
 * True when a spot is on the grandstand side near the main straight, where
 * the catch fence would stand between a camera and the road. Cameras there
 * move across to the pit side, which also puts the crowd behind the cars.
 */
function behindFence(layout: StadiumLayout, x: number, z: number): boolean {
  if (!layout.stands.length) return false;
  const c = Math.cos(layout.yaw);
  const s = Math.sin(layout.yaw);
  const along = (x - layout.x) * c - (z - layout.z) * s;
  const across = (x - layout.x) * s + (z - layout.z) * c;
  const lo = Math.min(...layout.stands.map((p) => p.along - p.length / 2)) - 70;
  const hi = Math.max(...layout.stands.map((p) => p.along + p.length / 2)) + 70;
  return Math.sign(across) === layout.side && along > lo && along < hi;
}

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
  // Grandstands need a wide berth (their fence and roof block the view); the pits only their own footprint, so the pit lane can host a camera.
  const stands = layout.pads.slice(0, layout.stands.length);
  const pit = layout.pit ? padOf(layout, -layout.side, layout.pit, 0.5) : null;
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
      if (distanceAt(field, x, z) < clear || behindFence(layout, x, z) || stands.some((p) => padWeight(p, x, z, 4) > 0)) continue;
      if (pit && padWeight(pit, x, z, 0.5) > 0) continue;
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

/** Signed road distance from the car to a station, wrapped to half a lap either way: negative once the car has passed it. */
function lead(carS: number, stationS: number, len: number): number {
  const d = ahead(carS, stationS, len);
  return d > len / 2 ? d - len : d;
}

/** How far a station keeps the shot after the car passes it, and how close the car must be before cutting to it, m. */
const KEEP_PAST = 40;
const CUT_AHEAD = 60;

/**
 * Picks the station to watch from. A station holds the shot while the car
 * is coming toward it and until the car is 40 m past; then the director
 * cuts to the nearest station ahead, never one more than 60 m away, so the
 * long lens never has to find a speck in the distance. With stations about
 * 95 m apart the cuts chain round the lap.
 */
export function pickStation(stations: Station[], current: number, carS: number, len: number): number {
  if (!stations.length) return -1;
  if (current >= 0 && current < stations.length) {
    const d = lead(carS, stations[current].s, len);
    if (d >= -KEEP_PAST && d <= CUT_AHEAD + 30) return current;
  }
  let best = -1;
  let bestD = Infinity;
  stations.forEach((st, k) => {
    const d = lead(carS, st.s, len);
    // The nearest station ahead, or the one the car has only just passed.
    if (d >= -KEEP_PAST && d < bestD) {
      bestD = d;
      best = k;
    }
  });
  return best >= 0 ? best : 0;
}
