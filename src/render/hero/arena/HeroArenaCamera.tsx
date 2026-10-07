'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { fitDistance } from '@/render/hideseek/camera/framing';
import { useHsScene } from '@/render/hideseek/frame/sceneContext';
import { ARENA_SPAN } from '@/render/hideseek/layout/gridLattice';
import { cityEdgeFrom, farPlane, hazeRange } from '@/render/hideseek/scene/haze';
import { stepSpring } from '@/render/shared/interpolate';

/** Elevation of the shot: steep enough to see players over the walls, low enough that walls and ramps still read as 3D. */
const ELEVATION = (55 * Math.PI) / 180;
/** Share of the way from the room center toward the followed player that the shot leans. */
const LEAN = 0.35;
/** How far past the framed point the camera aims, m. It sets the room a little low, under the page text. */
const LEAD = 2.5;
/** Radians per second the camera circles the room. A full turn takes over two minutes. */
const SPIN = 0.045;

/**
 * A crane shot of the whole room for the landing page. It circles slowly
 * and leans toward the player whose brain is on screen (the first hider
 * while hiders hide, the first seeker once the seekers wake) on a soft
 * spring, so the shot follows the action without losing the room. The
 * haze keeps in step with its distance like the lab camera.
 */
export function HeroArenaCamera() {
  const { frame } = useHsScene();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  // The lab's own fit for one room, a little closer, since the edges of the frame sit under nothing. Worked out per size, not per frame.
  const distance = useMemo(() => fitDistance(ARENA_SPAN, ARENA_SPAN, camera.fov, size.width / Math.max(1, size.height), ELEVATION) * 0.95, [camera.fov, size]);
  const s = useMemo(
    () => ({ angle: 0.6, x: { value: 0, velocity: 0 }, z: { value: 0, velocity: 0 }, pose: { x: 0, z: 0, yaw: 0, elevation: 0 }, haze: { near: 0, far: 0 } }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.25);
    const angle = (s.angle += dt * SPIN);
    const followed = frame.agentPose !== null && frame.agentPose(frame.prep ? 0 : 1, s.pose) >= 0;
    const cx = stepSpring(s.x, followed ? s.pose.x * LEAN : 0, 1.2, dt);
    const cz = stepSpring(s.z, followed ? s.pose.z * LEAN : 0, 1.2, dt);
    const dx = Math.sin(angle);
    const dz = Math.cos(angle);
    const flat = Math.cos(ELEVATION) * distance;
    camera.position.set(cx + dx * flat, Math.sin(ELEVATION) * distance, cz + dz * flat);
    camera.lookAt(cx - dx * LEAD, 0, cz - dz * LEAD);

    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      hazeRange(distance, cityEdgeFrom(cx, cz, frame.lattice.width / 2, frame.lattice.depth / 2), s.haze);
      fog.near = s.haze.near;
      fog.far = s.haze.far;
    }
    const near = THREE.MathUtils.clamp(distance * 0.012, 0.05, 4);
    const far = farPlane(distance);
    if (Math.abs(camera.near - near) > near * 0.1 || Math.abs(camera.far - far) > far * 0.1) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
