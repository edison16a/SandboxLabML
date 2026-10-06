'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { MapControls, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { useRacingLab, type CameraMode } from '@/features/racing/state/labStore';
import { springStep } from '@/render/shared/interpolate';
import { useRacingScene } from './sceneContext';

/**
 * Four cameras. Chase rides a critically damped spring behind the focus car,
 * orbit circles it, top-down frames the whole track for the editor, and free
 * is a pan and zoom map camera.
 */
export function CameraRig({ mode, target }: { mode: CameraMode; target: React.RefObject<THREE.Vector3> }) {
  const { frame, track } = useRacingScene();
  const camera = useThree((s) => s.camera);
  const orbit = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const spring = useMemo(() => ({ x: 0, vx: 0, y: 0, vy: 0, z: 0, vz: 0, yaw: 0, init: false }), []);
  const look = useMemo(() => new THREE.Vector3(), []);

  const center = useMemo(() => {
    const b = track.bounds;
    return { x: (b.minX + b.maxX) / 2, z: -(b.minY + b.maxY) / 2, size: Math.max(b.maxX - b.minX, b.maxY - b.minY) };
  }, [track]);

  useEffect(() => {
    spring.init = false;
    if (mode === 'top' || mode === 'free') {
      camera.position.set(center.x, center.size * 1.05 + 40, center.z + 0.01);
      camera.lookAt(center.x, 0, center.z);
    }
  }, [mode, camera, center, spring]);

  useFrame((_, rawDt) => {
    // A generous clamp keeps the spring stable after a stall without leaving the camera behind on slow GPUs.
    const dt = Math.min(rawDt, 0.25);
    const focus = frame.focusPos;
    if (mode === 'chase') {
      // Aim behind the car along its heading, smoothing heading separately so turns feel weighty.
      const yawDelta = Math.atan2(Math.sin(frame.focusYaw - spring.yaw), Math.cos(frame.focusYaw - spring.yaw));
      spring.yaw = spring.init ? spring.yaw + yawDelta * Math.min(1, dt * 3.2) : frame.focusYaw;
      const back = 9 + frame.focusSpeed * 0.1;
      const tx = focus.x - Math.cos(spring.yaw) * back;
      const tz = focus.z + Math.sin(spring.yaw) * back;
      const ty = 3.3 + frame.focusSpeed * 0.035;
      const far = (spring.x - tx) ** 2 + (spring.z - tz) ** 2 > 60 * 60;
      if (!spring.init || far) {
        // Jump instead of flying across the map when the focus changes to a distant car.
        Object.assign(spring, { x: tx, y: ty, z: tz, vx: 0, vy: 0, vz: 0, init: true, yaw: frame.focusYaw });
      }
      [spring.x, spring.vx] = springStep(spring.x, spring.vx, tx, 6, dt);
      [spring.y, spring.vy] = springStep(spring.y, spring.vy, ty, 6, dt);
      [spring.z, spring.vz] = springStep(spring.z, spring.vz, tz, 6, dt);
      camera.position.set(spring.x, spring.y, spring.z);
      look.set(focus.x + Math.cos(spring.yaw) * 6, 1.2, focus.z - Math.sin(spring.yaw) * 6);
      camera.lookAt(look);
      target.current?.copy(focus);
    } else if (mode === 'orbit') {
      const c = orbit.current;
      if (c) {
        c.target.lerp(focus, Math.min(1, dt * 6));
        c.update();
      }
      target.current?.copy(focus);
    } else {
      target.current?.set(camera.position.x, 0, camera.position.z - 30);
    }
  });

  if (mode === 'orbit') {
    return <OrbitControls ref={orbit} makeDefault enableDamping dampingFactor={0.08} minDistance={6} maxDistance={220} maxPolarAngle={Math.PI / 2.08} />;
  }
  if (mode === 'free') return <MapControls makeDefault enableDamping screenSpacePanning={false} maxPolarAngle={Math.PI / 2.1} minDistance={10} maxDistance={1500} />;
  if (mode === 'top') return <MapControls makeDefault enableRotate={false} screenSpacePanning minDistance={20} maxDistance={1500} />;
  return null;
}

export function cameraLabel(mode: CameraMode): string {
  return { chase: 'Chase', orbit: 'Orbit', top: 'Top down', free: 'Free' }[mode];
}

export function useCameraMode(): CameraMode {
  return useRacingLab((s) => (s.editingTrack ? 'top' : s.camera));
}
