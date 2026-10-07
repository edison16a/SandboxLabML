'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { useHsScene } from '@/render/hideseek/frame/sceneContext';
import { cityEdgeFrom, farPlane, hazeRange } from '@/render/hideseek/scene/haze';
import { stepSpring } from '@/render/shared/interpolate';

/** Elevation of the shot, the lab's own: steep enough to see a player over most walls, low enough that walls and ramps still read as 3D. */
const ELEVATION = (60 * Math.PI) / 180;
/** Camera distance from the followed player, m. About half the room fits, so players are big enough to read. */
const DISTANCE = 18;
/** How far past the player the camera aims, m. It puts the player in the lower third, under the page text. */
const LEAD = 5;
/** Radians per second the camera circles the room. A full turn takes over two minutes. */
const SPIN = 0.045;

/**
 * A crane shot for the landing page that keeps the player whose brain is
 * on screen in the lower third: the first hider while hiders hide, the
 * first seeker once the seekers wake. It follows that player on a soft
 * spring, gliding across the room when the seekers wake, and slowly
 * circles so the shot keeps moving even when the player stands still. The
 * haze keeps in step with its distance like the lab camera.
 */
export function HeroArenaCamera() {
  const { frame } = useHsScene();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  const s = useMemo(
    () => ({ angle: 0.6, x: { value: 0, velocity: 0 }, z: { value: 0, velocity: 0 }, init: false, pose: { x: 0, z: 0, yaw: 0, elevation: 0 }, haze: { near: 0, far: 0 } }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.25);
    const angle = (s.angle += dt * SPIN);
    const followed = frame.agentPose !== null && frame.agentPose(frame.prep ? 0 : 1, s.pose) >= 0;
    const px = followed ? s.pose.x : 0;
    const pz = followed ? s.pose.z : 0;
    if (!s.init) {
      s.init = true;
      s.x.value = px;
      s.z.value = pz;
    }
    const cx = stepSpring(s.x, px, 1.4, dt);
    const cz = stepSpring(s.z, pz, 1.4, dt);
    const dx = Math.sin(angle);
    const dz = Math.cos(angle);
    const flat = Math.cos(ELEVATION) * DISTANCE;
    camera.position.set(cx + dx * flat, Math.sin(ELEVATION) * DISTANCE, cz + dz * flat);
    camera.lookAt(cx - dx * LEAD, 0, cz - dz * LEAD);

    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      hazeRange(DISTANCE, cityEdgeFrom(cx, cz, frame.lattice.width / 2, frame.lattice.depth / 2), s.haze);
      fog.near = s.haze.near;
      fog.far = s.haze.far;
    }
    const near = THREE.MathUtils.clamp(DISTANCE * 0.012, 0.05, 4);
    const far = farPlane(DISTANCE);
    if (Math.abs(camera.near - near) > near * 0.1 || Math.abs(camera.far - far) > far * 0.1) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
