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
/** Share of the lab's whole room fit the camera stands at. Closer than the fit, so players read larger. */
const ZOOM = 0.8;
/** Share of the way from the room center toward the followed player that the shot leans. Nearly all the way, so that player is the subject. */
const LEAN = 0.9;
/**
 * How far past the framed point the camera aims, as a share of its
 * distance. It sets the framed point about 80% down the hero, under the
 * page text and between the corner cards, like the car in the racing
 * scene, with room below for a player running toward the camera.
 */
const LEAD = 0.3;
/** Radians per second the camera circles the room. A full turn takes over two minutes. */
const SPIN = 0.045;
/**
 * Stiffness of the spring that follows the player, 1/s. A soft spring
 * trails a running player by about twice their speed over this, so at 2.4
 * a sprinting seeker stays within a few meters of the framed point while
 * the switch from hider to seeker still glides across the room.
 */
const FOLLOW = 2.4;

/**
 * A crane shot of the room for the landing page. It circles slowly and
 * leans toward the player whose brain is on screen (the first hider while
 * hiders hide, the first seeker once the seekers wake) on a soft spring,
 * keeping the action in the lower third under the page text with the rest
 * of the room behind it. The haze keeps in step with its distance like
 * the lab camera.
 */
export function HeroArenaCamera() {
  const { frame } = useHsScene();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  // The lab's own fit for one room, brought closer. Worked out per size, not per frame.
  const distance = useMemo(() => fitDistance(ARENA_SPAN, ARENA_SPAN, camera.fov, size.width / Math.max(1, size.height), ELEVATION) * ZOOM, [camera.fov, size]);
  const s = useMemo(
    () => ({ angle: 0.6, placed: false, x: { value: 0, velocity: 0 }, z: { value: 0, velocity: 0 }, pose: { x: 0, z: 0, yaw: 0, elevation: 0 }, haze: { near: 0, far: 0 } }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.25);
    const angle = (s.angle += dt * SPIN);
    const followed = frame.agentPose !== null && frame.agentPose(frame.prep ? 0 : 1, s.pose) >= 0;
    const tx = followed ? s.pose.x * LEAN : 0;
    const tz = followed ? s.pose.z * LEAN : 0;
    if (followed && !s.placed) {
      // The first shot opens on the player rather than gliding over from the room center as the scene fades in.
      s.placed = true;
      s.x.value = tx;
      s.z.value = tz;
    }
    const cx = stepSpring(s.x, tx, FOLLOW, dt);
    const cz = stepSpring(s.z, tz, FOLLOW, dt);
    const dx = Math.sin(angle);
    const dz = Math.cos(angle);
    const flat = Math.cos(ELEVATION) * distance;
    camera.position.set(cx + dx * flat, Math.sin(ELEVATION) * distance, cz + dz * flat);
    camera.lookAt(cx - dx * LEAD * distance, 0, cz - dz * LEAD * distance);

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
