import * as THREE from 'three';
import type { City } from '@/engine/driving/city/types';
import type { Route } from '@/engine/driving/route/route';
import { stepSpring, type Spring } from '@/render/shared/interpolate';
import type { DrivingFrame } from '../frame/sceneContext';
import { CLUTTER, rankArrivalSpots, rankCornerSpots, type CornerSpot } from './cornerSight';
import { sees, sightWorld } from './sightLines';

/** Frames between two checks that the car is still in sight. */
const CHECK_EVERY = 6;
/** How long the car may stay hidden before the camera moves to the next spot, s. */
const HIDDEN_FOR = 0.5;

/**
 * A fixed street corner camera at the next intersection on the route, the
 * TV shot of a car arriving, waiting at the light and turning. It stands on
 * a far corner, the side the car turns away from when that view is clear,
 * so the whole maneuver plays out in front of it, about head height on a
 * step ladder. It only pans to keep the car framed; once the car is
 * through it cuts to the next corner, and after the last one to a spot
 * past the destination, looking back at the car rolling in. Every few frames it checks that it
 * still sees the car past the furniture and the buildings, and if the car
 * stays hidden for half a second it cuts to the next best spot.
 */
export interface CornerCam {
  node: number;
  look: THREE.Vector3;
  lx: Spring;
  ly: Spring;
  lz: Spring;
  epoch: number;
  /** The junction's spots, best first, and the one in use. */
  spots: CornerSpot[];
  spot: number;
  hidden: number;
  frames: number;
}

export function cornerCam(): CornerCam {
  const s = () => ({ value: 0, velocity: 0 });
  return { node: -1, look: new THREE.Vector3(), lx: s(), ly: s(), lz: s(), epoch: -1, spots: [], spot: 0, hidden: 0, frames: 0 };
}

/** The next route maneuver the car has not finished, or -1 once it is through them all. */
function nextTurn(route: Route, progress: number): number {
  for (let k = 0; k < route.turns.length; k++) if (route.turns[k].end > progress - 4) return k;
  return -1;
}

/** Marks the arrival as the junction in use, once the car is past its last one. */
const ARRIVAL = -2;

/** Puts the camera on spot `k` of the junction's list and points it straight at the car, without a glide. */
function cutTo(c: CornerCam, k: number, frame: DrivingFrame, camera: THREE.PerspectiveCamera): void {
  c.spot = k;
  c.hidden = 0;
  const spot = c.spots[k];
  camera.position.set(spot.x, spot.height, -spot.y);
  c.lx.value = frame.pos.x;
  c.ly.value = 1;
  c.lz.value = frame.pos.z;
  c.lx.velocity = c.ly.velocity = c.lz.velocity = 0;
}

/** Counts how long the car has been out of sight and moves on down the list once it has been for too long. */
function keepInSight(c: CornerCam, frame: DrivingFrame, city: City, camera: THREE.PerspectiveCamera, dt: number): void {
  c.hidden += dt;
  if (++c.frames % CHECK_EVERY !== 0) return;
  const spot = c.spots[c.spot];
  if (sees(sightWorld(city), spot.x, spot.y, spot.height, frame.pos.x, -frame.pos.z, 1, CLUTTER)) c.hidden = 0;
  else if (c.hidden >= HIDDEN_FOR && c.spot + 1 < c.spots.length) cutTo(c, c.spot + 1, frame, camera);
}

export function stepCorner(c: CornerCam, frame: DrivingFrame, city: City, route: Route | null, camera: THREE.PerspectiveCamera, dt: number): void {
  if (!route) return;
  const k = nextTurn(route, frame.progress);
  const t = k >= 0 ? route.turns[k] : null;
  const node = t ? t.node : ARRIVAL;
  if (node !== c.node || c.epoch !== frame.epoch) {
    c.node = node;
    c.epoch = frame.epoch;
    // Across the junction from the approach, on whichever far corner sees the whole maneuver best,
    // or past the destination looking back once no junction is left (see cornerSight).
    c.spots = t ? rankCornerSpots(city, t.node, city.elements[t.element].dir, t.turn) : rankArrivalSpots(city, route);
    cutTo(c, 0, frame, camera);
  } else keepInSight(c, frame, city, camera, dt);
  c.look.set(stepSpring(c.lx, frame.pos.x, 4, dt), stepSpring(c.ly, 1, 4, dt), stepSpring(c.lz, frame.pos.z, 4, dt));
  camera.lookAt(c.look);
  // Zoom in as the car comes down the street, out as it passes close.
  const dist = camera.position.distanceTo(c.look);
  const fov = THREE.MathUtils.clamp(2 * Math.atan(9 / Math.max(dist, 1)) * (180 / Math.PI), 22, 62);
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }
}
