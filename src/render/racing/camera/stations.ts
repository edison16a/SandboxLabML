import { RUNOFF } from '@/engine/racing/car/runtime';
import { nearestSample } from '@/engine/racing/track/locate';
import { padWeight, type Pad, type StadiumLayout } from '../stadium/layout';
import { PIT_CANOPY, PIT_TOP } from '../stadium/pitGeometry';
import { terrainHeight } from '../world/terrain/terrainHeight';
import { distanceAt } from '../world/trackField';
import type { WorldData } from '../world/worldData';
import { canSee, keepOut, occluders } from './sightLines';

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

/** The stretch of road a station covers, m before and after its own spot (what pickStation holds it for), and how often it is checked. */
const COVER_BEFORE = 90;
const COVER_AFTER = 40;
const COVER_STEP = 10;

/** True when a camera at (x, y, z) sees the road from 90 m before sample i to 40 m past it with nothing in the way. */
function coversRoad(world: WorldData, blockers: Pad[], x: number, y: number, z: number, i: number): boolean {
  const { track, shape } = world;
  for (let d = -COVER_BEFORE; d <= COVER_AFTER; d += COVER_STEP) {
    const j = (i + Math.round(d / track.spacing) + track.count) % track.count;
    if (!canSee(shape, blockers, x, y, z, track.cx[j], -track.cy[j])) return false;
  }
  return true;
}

/** A camera spot beside sample i, `lat` meters left of the centerline, if it is clear of the road, the buildings and the fence. */
function spotAt(world: WorldData, i: number, lat: number, keep: Pad[], blockers: Pad[], height: number): Station | null {
  const { track, field, shape, layout } = world;
  // The start gantry's legs stand beside the line and would fill the lens.
  if (Math.min(track.s[i], track.length - track.s[i]) < 14) return null;
  const x = track.cx[i] - track.ty[i] * lat;
  const z = -(track.cy[i] + track.tx[i] * lat);
  if (distanceAt(field, x, z) < track.halfWidth + RUNOFF + 3.5 || behindFence(layout, x, z)) return null;
  if (keep.some((p) => padWeight(p, x, z, 0.5) > 0)) return null;
  const y = terrainHeight(shape, x, z) + height;
  return coversRoad(world, blockers, x, y, z, i) ? { x, y, z, s: track.s[i] } : null;
}

/**
 * Camera positions round the circuit, like a TV crew's: every 95 m or so,
 * just past the wall on alternating sides, on a few meters of tower. Each
 * spot is kept off the road, the stands, the pits and their lane, and it
 * must see the whole stretch it covers with no building or hill in the
 * way; if one side is blocked the other is tried. Poles at both ends of
 * the pit lane and a camera on the pit canopy cover the main straight.
 */
export function trackStations(world: WorldData): Station[] {
  const { track, layout } = world;
  const out: Station[] = [];
  const step = Math.max(1, Math.round(EVERY / track.spacing));
  const keep = keepOut(layout, 4);
  const blockers = occluders(layout);
  const lat = track.halfWidth + RUNOFF + 6.5;
  let flip = 1;
  // Both sides near sample i first, then a little further along or back, before leaving a gap.
  const near = (i: number, bend: number): Station | null => {
    for (const shift of [0, 15, -15, 30, -30, 45]) {
      const j = (i + Math.round(shift / track.spacing) + track.count) % track.count;
      for (const side of [-bend, bend, -bend * 1.3, bend * 1.3]) {
        const st = spotAt(world, j, side * lat, keep, blockers, 4.5 + (out.length % 3) * 1.2);
        if (st) return st;
      }
    }
    return null;
  };
  for (let i = Math.round(30 / track.spacing); i < track.count; i += step) {
    // Prefer the outside of the bend, where the car swings toward the lens.
    const bend = Math.sign(track.curvature[(i + Math.round(25 / track.spacing)) % track.count]) || flip;
    flip = -flip;
    const st = near(i, bend);
    if (st) out.push(st);
  }
  const pit = layout.pit;
  if (pit) {
    const half = Math.max(pit.laneHalf ?? 0, pit.length / 2 + 0.6) + 6;
    const c = Math.cos(layout.yaw);
    const sn = Math.sin(layout.yaw);
    for (const end of [-1, 1]) {
      // The road sample level with a spot past the lane's end, and which of its sides the pits are on.
      const along = pit.along + end * half;
      const i = nearestSample(track, layout.x + along * c, -(layout.z - along * sn));
      // The pit side is the frame's -side across axis (sin, cos); the road's left normal in world x, z is (-ty, -tx).
      const pitLeft = Math.sign(-layout.side * (sn * -track.ty[i] + c * -track.tx[i])) || 1;
      const st = spotAt(world, i, pitLeft * lat, keep, blockers, 6);
      if (st) out.push(st);
    }
    // A camera on the canopy's front edge, at the end the cars arrive from, looks down the main straight over the pit wall.
    const across = -layout.side * (pit.offset - PIT_CANOPY + 0.4);
    const along = pit.along - pit.length / 2 + 2;
    const x = layout.x + along * c + across * sn;
    const z = layout.z - along * sn + across * c;
    const i = nearestSample(track, x, -z);
    if (coversRoad(world, blockers, x, PIT_TOP + 1.6, z, i)) out.push({ x, y: PIT_TOP + 1.6, z, s: track.s[i] });
  }
  fillGaps(track, out, near);
  return out;
}

/** Tries one more camera in the middle of any stretch longer than 140 m that no camera covers. */
function fillGaps(track: WorldData['track'], out: Station[], near: (i: number, bend: number) => Station | null): void {
  const sorted = out.map((st) => st.s).sort((a, b) => a - b);
  for (let k = 0; k < sorted.length; k++) {
    const gap = ahead(sorted[k], sorted[(k + 1) % sorted.length], track.length) || track.length;
    if (gap < 140) continue;
    const i = Math.round(((sorted[k] + gap / 2) % track.length) / track.spacing) % track.count;
    const st = near(i, Math.sign(track.curvature[i]) || 1);
    if (st) out.push(st);
  }
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
  for (let k = 0; k < stations.length; k++) {
    const d = lead(carS, stations[k].s, len);
    // The nearest station ahead, or the one the car has only just passed.
    if (d >= -KEEP_PAST && d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best >= 0 ? best : 0;
}
