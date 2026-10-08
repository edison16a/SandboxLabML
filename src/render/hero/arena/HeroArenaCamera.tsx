'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { WallDodge } from '@/render/hideseek/camera/wallDodge';
import { useHsScene } from '@/render/hideseek/frame/sceneContext';
import { XRAY_LAYER } from '@/render/hideseek/grid/scratch';
import { ARENA_SPAN } from '@/render/hideseek/layout/gridLattice';
import { cityEdgeFrom, farPlane, hazeRange } from '@/render/hideseek/scene/haze';
import { stepSpring } from '@/render/shared/interpolate';
import type { PaneView } from '../stage/paneView';
import { clampAim, HERO_ELEVATION, heroFrame } from './heroArenaShot';

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
/** The point on the player the camera must see, m over its feet: the middle of its head. */
const SIGHT = 1.05;
const HALF = ARENA_SPAN / 2;

/**
 * A crane shot of the room for the landing page. It circles slowly and
 * follows the player whose brain is on screen (the first hider while
 * hiders hide, the first seeker once the seekers wake) on a spring, at a
 * size where faces read. The aim stays where the shot shows the room
 * rather than the city round it (see clampAim). When a wall hides the
 * player for a moment, the camera swings round it or rises over it (see
 * WallDodge), like the lab's cameras. The stage's shifted lens puts the aim in the
 * middle of the part of the pane the page text leaves free.
 */
export function HeroArenaCamera({ pane }: { pane: PaneView }) {
  const { frame } = useHsScene();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  const s = useMemo(
    () => ({
      view: { azimuth: 0.6, elevation: HERO_ELEVATION },
      dodge: new WallDodge(),
      head: { x: 0, y: 0, z: 0 },
      center: { x: 0, y: 0.4, z: 0 },
      placed: false,
      x: { value: 0, velocity: 0 },
      z: { value: 0, velocity: 0 },
      pose: { x: 0, z: 0, yaw: 0, elevation: 0 },
      aim: { x: 0, z: 0 },
      shot: { distance: 1, across: 1, deep: 1 },
      haze: { near: 0, far: 0 },
    }),
    [],
  );

  useEffect(() => {
    camera.layers.enable(XRAY_LAYER);
    return () => camera.layers.disable(XRAY_LAYER);
  }, [camera]);

  useFrame((_, rawDt) => {
    // Real time up to a second: the spring is stable at any step, and a slow machine must still keep the player framed.
    const dt = Math.min(rawDt, 1);
    const v = s.view;
    v.azimuth += dt * SPIN;
    const followed = frame.agentPose !== null && frame.agentPose(frame.prep ? 0 : 1, s.pose) >= 0;
    const shot = heroFrame(pane, camera.fov, v.elevation, s.shot);
    if (!followed) s.aim.x = s.aim.z = 0;
    const aim = followed ? clampAim(s.pose.x, s.pose.z, v.azimuth, shot, HALF, s.aim) : s.aim;
    if (followed && !s.placed) {
      // The first shot opens on the player rather than gliding over from the room center as the scene fades in.
      s.placed = true;
      s.x.value = aim.x;
      s.z.value = aim.z;
    }
    const cx = stepSpring(s.x, aim.x, FOLLOW, dt);
    const cz = stepSpring(s.z, aim.z, FOLLOW, dt);
    place(cx, cz, shot.distance);
    if (followed) {
      // The room sits at the origin, so world and room coordinates agree.
      s.head.x = s.pose.x;
      s.head.y = s.pose.elevation + SIGHT;
      s.head.z = s.pose.z;
      s.center.x = cx;
      s.center.z = cz;
      if (s.dodge.update(v, camera.position, s.head, s.center, shot.distance, HERO_ELEVATION, frame.walls, dt)) place(cx, cz, shot.distance);
    }

    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      hazeRange(shot.distance, cityEdgeFrom(cx, cz, frame.lattice.width / 2, frame.lattice.depth / 2), s.haze);
      fog.near = s.haze.near;
      fog.far = s.haze.far;
    }
    const near = THREE.MathUtils.clamp(shot.distance * 0.012, 0.05, 4);
    const far = farPlane(shot.distance);
    if (Math.abs(camera.near - near) > near * 0.1 || Math.abs(camera.far - far) > far * 0.1) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  });

  /** Puts the camera `distance` m from the aim (cx, cz) at the current view angle. */
  function place(cx: number, cz: number, distance: number): void {
    const flat = Math.cos(s.view.elevation) * distance;
    camera.position.set(cx + Math.sin(s.view.azimuth) * flat, Math.sin(s.view.elevation) * distance, cz + Math.cos(s.view.azimuth) * flat);
    camera.lookAt(cx, 0.4, cz);
  }

  return null;
}
