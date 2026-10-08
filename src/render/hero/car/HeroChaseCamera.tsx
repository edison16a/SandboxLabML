'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { FRAME_PRIORITY } from '@/render/racing/framePriority';
import { Trail } from '@/render/racing/camera/trail';
import { useRacingScene } from '@/render/racing/sceneContext';
import { stepSpring } from '@/render/shared/interpolate';
import type { PaneView } from '../stage/paneView';

/** Elevation of the shot. Low enough to keep a thin band of sky and hills over the road, high enough to see the line ahead. */
const ELEVATION = (19 * Math.PI) / 180;
/** The span of the car the shot sizes for, m: its length seen from three quarters behind. */
const CAR_SPAN = 3.2;
/** Share of the free part of the pane that span fills. */
const FILL = 0.55;
/** How far the camera aims past the car, m, so the road ahead gets a little more of the frame than the road behind. */
const AIM_AHEAD = 1.5;

/**
 * A camera drone for the landing page. It sits three quarters behind the
 * car and looks at it, and the stage's shifted lens puts the car in the
 * middle of the part of its pane the page text leaves free. It flies along
 * the path the car has just driven rather than straight behind it, so in a
 * hairpin it stays over the road instead of swinging out into the pines,
 * and it drifts slowly from side to side so the shot never looks parked.
 * The springs ease its offset from the car, so speed never drags it back.
 */
export function HeroChaseCamera({ target, pane }: { target: React.RefObject<THREE.Vector3>; pane: PaneView }) {
  const { frame } = useRacingScene();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const s = useMemo(
    () => ({ x: { value: 0, velocity: 0 }, y: { value: 0, velocity: 0 }, z: { value: 0, velocity: 0 }, init: false, t: 0, look: new THREE.Vector3(), trail: new Trail(), at: { x: 0, z: 0, dx: 1, dz: 0 }, last: new THREE.Vector3() }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1);
    s.t += dt;
    const focus = frame.focusPos;
    const fx = Math.cos(frame.focusYaw);
    const fz = -Math.sin(frame.focusYaw);
    s.trail.push(focus.x, focus.z);
    // The distance that makes the car fill its share of the free zone, a little further back at speed.
    const { w, h } = pane.rect;
    const lens = h / 2 / Math.tan((camera.fov * Math.PI) / 360);
    const zone = Math.max(80, Math.min(pane.zoneW * w, pane.zoneH * h));
    const distance = THREE.MathUtils.clamp((CAR_SPAN * lens) / (FILL * zone), 8, 30) * (1 + frame.focusSpeed * 0.006);
    const back = Math.cos(ELEVATION) * distance;
    if (!s.trail.behind(back, s.at)) {
      s.at.x = focus.x - fx * back;
      s.at.z = focus.z - fz * back;
      s.at.dx = fx;
      s.at.dz = fz;
    }
    // The drift crosses behind the car about once a minute.
    const side = Math.sin(s.t * 0.11) * distance * 0.16;
    const tx = s.at.x - s.at.dz * side;
    const tz = s.at.z + s.at.dx * side;
    const ty = 0.6 + Math.sin(ELEVATION) * distance;
    // Jump instead of flying across the map when the car restarts on the grid.
    const jumped = s.last.distanceToSquared(focus) > 60 * 60;
    s.last.copy(focus);
    if (!s.init || jumped) {
      s.init = true;
      s.x.value = tx - focus.x;
      s.y.value = ty;
      s.z.value = tz - focus.z;
      s.x.velocity = s.y.velocity = s.z.velocity = 0;
    }
    camera.position.set(focus.x + stepSpring(s.x, tx - focus.x, 5, dt), stepSpring(s.y, ty, 5, dt), focus.z + stepSpring(s.z, tz - focus.z, 5, dt));
    s.look.set(focus.x + fx * AIM_AHEAD, 0.7, focus.z + fz * AIM_AHEAD);
    camera.lookAt(s.look);
    target.current?.copy(focus);
  }, FRAME_PRIORITY.camera);
  return null;
}
