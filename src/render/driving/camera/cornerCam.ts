import * as THREE from 'three';
import type { City } from '@/engine/driving/city/types';
import type { Route } from '@/engine/driving/route/route';
import { stepSpring, type Spring } from '@/render/shared/interpolate';
import type { DrivingFrame } from '../frame/sceneContext';
import { pickCornerSpot } from './cornerSight';

/**
 * A fixed street corner camera at the next intersection on the route, the
 * TV shot of a car arriving, waiting at the light and turning. It stands on
 * a far corner, the side the car turns away from when that view is clear,
 * so the whole maneuver plays out in front of it, about head height on a
 * step ladder. It only pans to keep the car framed;
 * once the car is through it cuts to the next corner.
 */
export interface CornerCam {
  node: number;
  look: THREE.Vector3;
  lx: Spring;
  ly: Spring;
  lz: Spring;
  epoch: number;
}

export function cornerCam(): CornerCam {
  const s = () => ({ value: 0, velocity: 0 });
  return { node: -1, look: new THREE.Vector3(), lx: s(), ly: s(), lz: s(), epoch: -1 };
}

/** The next route maneuver the car has not finished, or the last one. */
function nextTurn(route: Route, progress: number): number {
  for (let k = 0; k < route.turns.length; k++) if (route.turns[k].end > progress - 4) return k;
  return route.turns.length - 1;
}

export function stepCorner(c: CornerCam, frame: DrivingFrame, city: City, route: Route | null, camera: THREE.PerspectiveCamera, dt: number): void {
  if (!route || route.turns.length === 0) return;
  const k = nextTurn(route, frame.progress);
  const t = route.turns[k];
  const cut = t.node !== c.node || c.epoch !== frame.epoch;
  if (cut) {
    c.node = t.node;
    c.epoch = frame.epoch;
    // Across the junction from the approach, on whichever far corner sees the approach clearly (see pickCornerSpot).
    const spot = pickCornerSpot(city, t.node, city.elements[t.element].dir, t.turn);
    camera.position.set(spot.x, spot.height, -spot.y);
  }
  const tx = frame.pos.x;
  const tz = frame.pos.z;
  if (cut) {
    c.lx.value = tx;
    c.ly.value = 1;
    c.lz.value = tz;
    c.lx.velocity = c.ly.velocity = c.lz.velocity = 0;
  }
  c.look.set(stepSpring(c.lx, tx, 4, dt), stepSpring(c.ly, 1, 4, dt), stepSpring(c.lz, tz, 4, dt));
  camera.lookAt(c.look);
  // Zoom in as the car comes down the street, out as it passes close.
  const dist = camera.position.distanceTo(c.look);
  const fov = THREE.MathUtils.clamp(2 * Math.atan(9 / Math.max(dist, 1)) * (180 / Math.PI), 22, 62);
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }
}
