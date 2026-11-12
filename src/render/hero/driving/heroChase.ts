import * as THREE from 'three';
import { CHASE_SPOT } from '@/engine/hero/driver/camera';
import { chaseAnchor, stepAnchor, type ChaseAnchor } from '@/render/driving/camera/chaseAnchor';
import type { DrivingFrame } from '@/render/driving/frame/sceneContext';
import { stepSpring, type Spring } from '@/render/shared/interpolate';
import type { PaneView } from '../stage/paneView';

/** The shot: how far round from straight behind (to the SUV's left, over the middle of the road) and how high it looks down, rad. */
export const CHASE = {
  side: CHASE_SPOT.side,
  elevation: (13 * Math.PI) / 180,
  /** The SUV's span seen from three quarters behind, m, and the share of the free part of the pane it fills. */
  span: 3.2,
  fill: 0.55,
  /**
   * Distance limits, m: never so close the SUV crowds the frame, never so
   * far the camera reaches the trees along the far curb or a corner
   * building gets in the way. The streets are narrow, so the side angle
   * stays small and the camera stays over the road. The hero's trips are
   * picked to keep traffic off this stretch (see carAtCamera).
   */
  near: CHASE_SPOT.near,
  far: CHASE_SPOT.far,
  /** Meters of road over which the shot turns most of the way round with the SUV, so a corner is a slow swing. */
  turnDistance: 10,
  /** How stiffly the camera holds its place round the anchor, 1/s. */
  grip: 4,
};

/**
 * The hero's chase camera state. It follows its own anchor, which glides
 * after the SUV on springs (the lab's chase anchor), never the SUV itself,
 * so a stutter in the SUV's motion never reaches the picture.
 */
export interface HeroChase {
  anchor: ChaseAnchor;
  x: Spring;
  y: Spring;
  z: Spring;
  /** The direction the shot looks from, rad, turning after the SUV per meter of road. */
  yaw: number;
  look: THREE.Vector3;
  epoch: number;
}

export function heroChase(): HeroChase {
  const s = () => ({ value: 0, velocity: 0 });
  return { anchor: chaseAnchor(), x: s(), y: s(), z: s(), yaw: 0, look: new THREE.Vector3(), epoch: -1 };
}

/** How far back the camera stands so the SUV fills its share of the part of the shot the page text leaves free. */
export function chaseDistance(pane: PaneView, fovDeg: number): number {
  const { w, h } = pane.shot;
  const lens = h / 2 / Math.tan((fovDeg * Math.PI) / 360);
  const zone = Math.max(80, Math.min(pane.zoneW * w, pane.zoneH * h));
  return THREE.MathUtils.clamp((CHASE.span * lens) / (CHASE.fill * zone), CHASE.near, CHASE.far);
}

/**
 * Moves the camera one frame: a low three quarter view from behind and to
 * the left of the SUV, looking a little past it down the road. A new trip
 * puts it straight back in place, which only ever happens while the cut
 * is dark.
 */
export function stepHeroChase(c: HeroChase, frame: DrivingFrame, camera: THREE.PerspectiveCamera, pane: PaneView, dt: number): void {
  const a = c.anchor;
  if (c.epoch !== frame.epoch) {
    c.epoch = frame.epoch;
    a.ready = false;
  }
  const px = a.x;
  const pz = a.z;
  const snapped = stepAnchor(a, frame.pos.x, frame.pos.z, frame.yaw, 0, dt);
  if (snapped) c.yaw = a.heading;
  else {
    const moved = Math.hypot(a.x - px, a.z - pz);
    const delta = Math.atan2(Math.sin(a.heading - c.yaw), Math.cos(a.heading - c.yaw));
    c.yaw += delta * (1 - Math.exp(-(dt * 0.6 + moved / CHASE.turnDistance)));
  }
  const d = chaseDistance(pane, camera.fov);
  const flat = Math.cos(CHASE.elevation) * d;
  // Behind the SUV is (-cos, +sin) in world x and z, and its left is (-sin, -cos).
  const back = Math.cos(CHASE.side) * flat;
  const left = Math.sin(CHASE.side) * flat;
  const tx = -Math.cos(c.yaw) * back - Math.sin(c.yaw) * left;
  const tz = Math.sin(c.yaw) * back - Math.cos(c.yaw) * left;
  const ty = 0.9 + Math.sin(CHASE.elevation) * d;
  if (snapped) {
    c.x.value = tx;
    c.y.value = ty;
    c.z.value = tz;
    c.x.velocity = c.y.velocity = c.z.velocity = 0;
  }
  camera.position.set(a.x + stepSpring(c.x, tx, CHASE.grip, dt), stepSpring(c.y, ty, CHASE.grip, dt), a.z + stepSpring(c.z, tz, CHASE.grip, dt));
  const ahead = 2.5 + frame.speed * 0.15;
  c.look.set(a.x + Math.cos(a.heading) * ahead, 0.9, a.z - Math.sin(a.heading) * ahead);
  camera.lookAt(c.look);
}
