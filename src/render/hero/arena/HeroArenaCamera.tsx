'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { useHsScene } from '@/render/hideseek/frame/sceneContext';
import { XRAY_LAYER } from '@/render/hideseek/grid/scratch';
import { cityEdgeFrom, farPlane, hazeRange } from '@/render/hideseek/scene/haze';
import { stepSpring } from '@/render/shared/interpolate';
import type { PaneView } from '../stage/paneView';

/** Elevation of the shot: steep enough to see players over the walls, low enough that walls, ramps and faces still read. */
const ELEVATION = (50 * Math.PI) / 180;
/**
 * CSS px per meter of floor in the free part of the pane, so the players
 * keep one size on screen whatever the pane's shape: close enough to read
 * faces. The span it gives stays between a tight 9 m and a 16 m that holds
 * most of the room, on a wide pane beside the text or a stacked one under it.
 */
const PX_PER_M = 48;
const SPAN_MIN = 9;
const SPAN_MAX = 16;
/** Radians per second the camera circles the room. A full turn takes over two minutes. */
const SPIN = 0.045;
/**
 * Stiffness of the spring that follows the player, 1/s. A spring trails a
 * running player by about twice their speed over this, so at 3.2 a
 * sprinting seeker stays about 2 m from the framed point, well inside the
 * shot, while the switch from hider to seeker still glides across
 * the room.
 */
const FOLLOW = 3.2;

/**
 * A crane shot of the room for the landing page. It circles slowly and
 * follows the player whose brain is on screen (the first hider while
 * hiders hide, the first seeker once the seekers wake) on a spring.
 * The stage's shifted lens puts that point in the middle of the part of
 * the pane the page text leaves free, and the distance sizes the shot to
 * that part. Players behind walls show as faint silhouettes, like in the
 * lab, and the haze keeps in step with the distance like the lab camera.
 */
export function HeroArenaCamera({ pane }: { pane: PaneView }) {
  const { frame } = useHsScene();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  const s = useMemo(
    () => ({ angle: 0.6, placed: false, x: { value: 0, velocity: 0 }, z: { value: 0, velocity: 0 }, pose: { x: 0, z: 0, yaw: 0, elevation: 0 }, haze: { near: 0, far: 0 } }),
    [],
  );

  useEffect(() => {
    camera.layers.enable(XRAY_LAYER);
    return () => camera.layers.disable(XRAY_LAYER);
  }, [camera]);

  useFrame((_, rawDt) => {
    // Real time up to a second: the spring is stable at any step, and a slow machine must still keep the player framed.
    const dt = Math.min(rawDt, 1);
    const angle = (s.angle += dt * SPIN);
    const followed = frame.agentPose !== null && frame.agentPose(frame.prep ? 0 : 1, s.pose) >= 0;
    const tx = followed ? s.pose.x : 0;
    const tz = followed ? s.pose.z : 0;
    if (followed && !s.placed) {
      // The first shot opens on the player rather than gliding over from the room center as the scene fades in.
      s.placed = true;
      s.x.value = tx;
      s.z.value = tz;
    }
    const cx = stepSpring(s.x, tx, FOLLOW, dt);
    const cz = stepSpring(s.z, tz, FOLLOW, dt);
    // Far enough that the span fits the free zone both across and deep, the floor's depth foreshortened by the elevation.
    const { w, h } = pane.rect;
    const span = THREE.MathUtils.clamp(Math.min(pane.zoneW * w, pane.zoneH * h) / PX_PER_M, SPAN_MIN, SPAN_MAX);
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const aspect = w / Math.max(1, h);
    const distance = Math.max(span / (2 * tan * aspect * pane.zoneW), (span * Math.sin(ELEVATION)) / (2 * tan * pane.zoneH));
    const dx = Math.sin(angle);
    const dz = Math.cos(angle);
    const flat = Math.cos(ELEVATION) * distance;
    camera.position.set(cx + dx * flat, Math.sin(ELEVATION) * distance, cz + dz * flat);
    camera.lookAt(cx, 0.4, cz);

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
