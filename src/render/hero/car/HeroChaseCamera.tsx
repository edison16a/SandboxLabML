'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { Trail } from '@/render/racing/camera/trail';
import { useRacingScene } from '@/render/racing/sceneContext';
import { stepSpring } from '@/render/shared/interpolate';

/**
 * A camera drone for the landing page, set high and well back so the car
 * sits under the page text with the road ahead in view. It flies along
 * the path the car has just driven rather than straight behind it, so in a
 * hairpin it stays over the road instead of swinging out into the pines,
 * and it drifts slowly from side to side so the shot never looks parked.
 */
export function HeroChaseCamera({ target }: { target: React.RefObject<THREE.Vector3> }) {
  const { frame } = useRacingScene();
  const camera = useThree((s) => s.camera);
  const s = useMemo(
    () => ({ x: { value: 0, velocity: 0 }, y: { value: 0, velocity: 0 }, z: { value: 0, velocity: 0 }, init: false, t: 0, look: new THREE.Vector3(), trail: new Trail(), at: { x: 0, z: 0, dx: 1, dz: 0 } }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1);
    s.t += dt;
    const focus = frame.focusPos;
    const fx = Math.cos(frame.focusYaw);
    const fz = -Math.sin(frame.focusYaw);
    s.trail.push(focus.x, focus.z);
    const back = 14 + frame.focusSpeed * 0.08;
    if (!s.trail.behind(back, s.at)) {
      s.at.x = focus.x - fx * back;
      s.at.z = focus.z - fz * back;
      s.at.dx = fx;
      s.at.dz = fz;
    }
    // The drift crosses behind the car about once a minute.
    const side = Math.sin(s.t * 0.11) * 3.2;
    const tx = s.at.x - s.at.dz * side;
    const tz = s.at.z + s.at.dx * side;
    const ty = 9.5 + frame.focusSpeed * 0.03;
    // Jump instead of flying across the map when the car restarts on the grid.
    if (!s.init || (s.x.value - tx) ** 2 + (s.z.value - tz) ** 2 > 60 * 60) {
      s.init = true;
      s.x.value = tx;
      s.y.value = ty;
      s.z.value = tz;
      s.x.velocity = s.y.velocity = s.z.velocity = 0;
    }
    camera.position.set(stepSpring(s.x, tx, 5, dt), stepSpring(s.y, ty, 5, dt), stepSpring(s.z, tz, 5, dt));
    // Looking down the road from up high puts the car in the lower third, under the page text, and keeps the sky to a thin band.
    s.look.set(focus.x + fx * 20, 0, focus.z + fz * 20);
    camera.lookAt(s.look);
    target.current?.copy(focus);
  });
  return null;
}
