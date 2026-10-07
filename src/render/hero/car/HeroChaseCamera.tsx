'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { stepSpring } from '@/render/shared/interpolate';
import { useRacingScene } from '@/render/racing/sceneContext';

/**
 * A camera drone for the landing page: the lab's chase spring, set high
 * and well back so the car sits under the page text with the road ahead
 * in view, and a slow drift from one side of the car to the other so the
 * shot never looks parked.
 */
export function HeroChaseCamera({ target }: { target: React.RefObject<THREE.Vector3> }) {
  const { frame } = useRacingScene();
  const camera = useThree((s) => s.camera);
  const s = useMemo(() => ({ x: { value: 0, velocity: 0 }, y: { value: 0, velocity: 0 }, z: { value: 0, velocity: 0 }, yaw: 0, init: false, t: 0, look: new THREE.Vector3() }), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.25);
    s.t += dt;
    const focus = frame.focusPos;
    const yawDelta = Math.atan2(Math.sin(frame.focusYaw - s.yaw), Math.cos(frame.focusYaw - s.yaw));
    s.yaw = s.init ? s.yaw + yawDelta * Math.min(1, dt * 2.4) : frame.focusYaw;
    const fx = Math.cos(s.yaw);
    const fz = -Math.sin(s.yaw);
    // The drift crosses behind the car about once a minute.
    const side = Math.sin(s.t * 0.11) * 3.2;
    const back = 14 + frame.focusSpeed * 0.08;
    const tx = focus.x - fx * back - fz * side;
    const tz = focus.z - fz * back + fx * side;
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
