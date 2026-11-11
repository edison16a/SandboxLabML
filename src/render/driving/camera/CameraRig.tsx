'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { MapControls, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { stepSpring } from '@/render/shared/interpolate';
import { FRAME_PRIORITY } from '../frame/FrameDriver';
import { useDrivingScene, type DrivingCamera } from '../frame/sceneContext';
import { chaseRig, restoreFov, stepChase } from './chaseRig';
import { cornerCam, stepCorner } from './cornerCam';

/** Height and lens of the top down view: a long lens from high up looks almost like a map. */
const TOP_HEIGHT = 150;
const TOP_FOV = 30;

/**
 * The cameras. Chase rides behind its own gliding anchor; orbit is a free
 * camera that travels with the car; corner is a fixed camera at the next
 * junction on the route; top down looks straight down and follows; free
 * is a pan and zoom map camera. `target` is kept on what the camera looks
 * at, so the sun's shadow box can follow it.
 */
export function CameraRig({ mode, target }: { mode: DrivingCamera; target: React.RefObject<THREE.Vector3> }) {
  const { frame, city, route } = useDrivingScene();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const chase = useMemo(() => chaseRig(), []);
  const corner = useMemo(() => cornerCam(), []);
  const top = useMemo(() => ({ x: { value: 0, velocity: 0 }, z: { value: 0, velocity: 0 }, epoch: -1 }), []);
  const orbit = useRef<{ target: THREE.Vector3; update(): void } | null>(null);
  const last = useMemo(() => new THREE.Vector3(), []);
  const placed = useRef(false);

  useEffect(() => {
    chase.anchor.ready = false;
    corner.node = -1;
    top.epoch = -1;
    restoreFov(camera, mode === 'top' ? TOP_FOV : undefined);
    const p = frame.pos;
    if (mode === 'free') {
      camera.position.set(p.x - 22, 18, p.z + 22);
      camera.lookAt(p.x, 0, p.z);
    }
    placed.current = mode !== 'orbit';
    last.copy(p);
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
      if (!placed.current && frame.focus >= 0) {
        // Start on a three quarter front view of the car, the angle a car is photographed from.
        const h = frame.yaw;
        const p = frame.pos;
        camera.position.set(p.x + Math.cos(h) * 5.6 - Math.sin(h) * 4.4, 1.6, p.z - Math.sin(h) * 5.6 - Math.cos(h) * 4.4);
        c.target.set(p.x, 0.9, p.z);
        last.copy(p);
        placed.current = true;
      }
      // Carry the orbit with the car so the chosen angle stays an angle on the car.
      camera.position.add(last.set(frame.pos.x - c.target.x, 0, frame.pos.z - c.target.z));
      c.target.set(frame.pos.x, 0.9, frame.pos.z);
      c.update();
      target.current?.copy(frame.pos);
      last.copy(frame.pos);
    } else if (mode === 'free') {
      target.current?.set(camera.position.x, 0, camera.position.z - 30);
    }
  }, FRAME_PRIORITY.camera);

  if (mode === 'orbit') return <OrbitControls ref={orbit as never} makeDefault enableDamping dampingFactor={0.08} minDistance={4} maxDistance={260} maxPolarAngle={Math.PI * 0.48} />;
  if (mode === 'free') return <MapControls makeDefault enableDamping screenSpacePanning={false} maxPolarAngle={Math.PI / 2.1} minDistance={8} maxDistance={900} />;
  return null;
}

export function cameraLabel(mode: DrivingCamera): string {
  return { chase: 'Chase', orbit: 'Orbit', corner: 'Street corner', top: 'Top down', free: 'Free' }[mode];
}
