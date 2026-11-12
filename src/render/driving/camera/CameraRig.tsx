'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { MapControls, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { stepSpring } from '@/render/shared/interpolate';
import { FRAME_PRIORITY } from '../frame/FrameDriver';
import { useDrivingScene, type DrivingCamera } from '../frame/sceneContext';
import { chaseRig, restoreFov, stepChase } from './chaseRig';
import { clearView, lensFloor, tallestNear } from './clearance';
import { cornerCam, stepCorner } from './cornerCam';

/** Height and lens of the top down view: a long lens from high up looks almost like a map. */
const TOP_HEIGHT = 150;
const TOP_FOV = 30;
/** Where the free camera starts: this far behind the car and at least this high, looking down on it, m. */
const FREE_BACK = 30;
const FREE_HEIGHT = 45;
/** Where the orbit camera starts round the car, m: far enough to frame the whole SUV, at eye height. */
const ORBIT_RADIUS = 7.1;
const ORBIT_HEIGHT = 1.6;

/** Angles round the car the orbit camera may start at, tried in turn until one has a clear view, degrees from the front. */
function orbitAngles(preferred: number): number[] {
  return [preferred, -preferred, 180 - preferred, preferred - 180, 90, -90];
}

/**
 * The cameras. Chase rides behind its own gliding anchor; orbit is a free
 * camera that travels with the car; corner is a fixed camera at the next
 * junction on the route; top down looks straight down and follows; free
 * is a pan and zoom map camera. `target` is kept on what the camera looks
 * at, so the sun's shadow box can follow it. Orbit starts at the first
 * angle round the car with a clear view (no traffic car at the lens or in
 * the way, no building) and rises over any car that drives into the lens;
 * free starts high above and behind the car, over the nearby rooftops.
 */
export function CameraRig({ mode, target }: { mode: DrivingCamera; target: React.RefObject<THREE.Vector3> }) {
  const { frame, city, route, view } = useDrivingScene();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const chase = useMemo(() => chaseRig(), []);
  const corner = useMemo(() => cornerCam(), []);
  const top = useMemo(() => ({ x: { value: 0, velocity: 0 }, z: { value: 0, velocity: 0 }, epoch: -1 }), []);
  const orbit = useRef<{ target: THREE.Vector3; update(): void } | null>(null);
  const free = useRef<{ target: THREE.Vector3; update(): void } | null>(null);
  const last = useMemo(() => new THREE.Vector3(), []);
  const placed = useRef(false);

  useEffect(() => {
    chase.anchor.ready = false;
    corner.node = -1;
    top.epoch = -1;
    restoreFov(camera, mode === 'top' ? TOP_FOV : undefined);
    placed.current = mode !== 'orbit' && mode !== 'free';
    last.copy(frame.pos);
  }, [mode, camera, chase, corner, top, frame, last]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1);
    if (mode === 'chase') {
      stepChase(chase, frame, camera, dt);
      target.current?.copy(frame.pos);
    } else if (mode === 'corner') {
      stepCorner(corner, frame, city, route, camera, dt);
      target.current?.copy(frame.pos);
    } else if (mode === 'top') {
      const snap = top.epoch !== frame.epoch;
      top.epoch = frame.epoch;
      if (snap) {
        top.x.value = frame.pos.x;
        top.z.value = frame.pos.z;
      }
      const x = stepSpring(top.x, frame.pos.x, 2.2, dt);
      const z = stepSpring(top.z, frame.pos.z, 2.2, dt);
      camera.position.set(x, TOP_HEIGHT, z + 0.001);
      camera.lookAt(x, 0, z);
      target.current?.set(x, 0, z);
    } else if (mode === 'orbit' && orbit.current) {
      const c = orbit.current;
      const p = frame.pos;
      if (!placed.current && frame.focus >= 0) {
        // Start on a three quarter front view of the car, the angle a car is photographed from, or the next clear one round it.
        const angles = orbitAngles(view.orbitAngle ?? 38);
        const clear = angles.find((a) => {
          const h = frame.yaw + (a * Math.PI) / 180;
          return clearView(city, frame.world, p.x + Math.cos(h) * ORBIT_RADIUS, -(p.z - Math.sin(h) * ORBIT_RADIUS), ORBIT_HEIGHT, p.x, -p.z);
        });
        const h = frame.yaw + ((clear ?? angles[0]) * Math.PI) / 180;
        camera.position.set(p.x + Math.cos(h) * ORBIT_RADIUS, ORBIT_HEIGHT, p.z - Math.sin(h) * ORBIT_RADIUS);
        c.target.set(p.x, 0.9, p.z);
        last.copy(p);
        placed.current = true;
      }
      // Carry the orbit with the car so the chosen angle stays an angle on the car.
      camera.position.add(last.set(p.x - c.target.x, 0, p.z - c.target.z));
      // A van that pulls up where the lens is lifts it over its roof, gently, rather than filling the frame from inside.
      const floor = lensFloor(frame.world, camera.position.x, -camera.position.z);
      if (camera.position.y < floor) camera.position.y += (floor - camera.position.y) * (1 - Math.exp(-dt * 6));
      c.target.set(p.x, 0.9, p.z);
      c.update();
      target.current?.copy(p);
      last.copy(p);
    } else if (mode === 'free' && free.current) {
      const c = free.current;
      if (!placed.current) {
        // High above and behind the car, over the tallest building nearby, looking down on it.
        const p = frame.pos;
        const height = Math.max(FREE_HEIGHT, tallestNear(city, p.x, -p.z, FREE_BACK + 15) + 12);
        camera.position.set(p.x - Math.cos(frame.yaw) * FREE_BACK, height, p.z + Math.sin(frame.yaw) * FREE_BACK);
        c.target.set(p.x, 0, p.z);
        c.update();
        placed.current = true;
      }
      target.current?.copy(c.target);
    }
  }, FRAME_PRIORITY.camera);

  if (mode === 'orbit') return <OrbitControls ref={orbit as never} makeDefault enableDamping dampingFactor={0.08} minDistance={4} maxDistance={260} maxPolarAngle={Math.PI * 0.48} />;
  if (mode === 'free') return <MapControls ref={free as never} makeDefault enableDamping screenSpacePanning={false} maxPolarAngle={Math.PI / 2.1} minDistance={8} maxDistance={900} />;
  return null;
}

export function cameraLabel(mode: DrivingCamera): string {
  return { chase: 'Chase', orbit: 'Orbit', corner: 'Street corner', top: 'Top down', free: 'Free' }[mode];
}
