'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { useRacingLab, type CameraMode } from '@/features/racing/state/labStore';
import { chaseRig, restoreFov, stepChase } from './camera/chaseRig';
import { keepAboveGround } from './camera/floor';
import { OrbitCam } from './camera/OrbitCam';
import { TracksideCam } from './camera/TracksideCam';
import { FRAME_PRIORITY } from './framePriority';
import { useRacingScene } from './sceneContext';
import { useWorld } from './world/useWorld';

/**
 * The cameras. Chase rides behind the focus car on springs with weight,
 * orbit is a free camera that travels with it, trackside cuts between TV
 * style cameras round the circuit, top down frames the whole track for the
 * editor, and free is a pan and zoom map camera.
 */
export function CameraRig({ mode, target }: { mode: CameraMode; target: React.RefObject<THREE.Vector3> }) {
  const { frame, track } = useRacingScene();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const editing = useRacingLab((s) => s.editingTrack);
  const world = useWorld(editing ? null : track);
  const chase = useMemo(() => chaseRig(), []);

  const center = useMemo(() => {
    const b = track.bounds;
    return { x: (b.minX + b.maxX) / 2, z: -(b.minY + b.maxY) / 2, size: Math.max(b.maxX - b.minX, b.maxY - b.minY) };
  }, [track]);

  const controls = useThree((s) => s.controls) as { target?: THREE.Vector3; update?: () => void } | null;
  const placed = useRef<{ key: string; controls: unknown } | null>(null);
  useEffect(() => {
    chase.init = false;
    if (mode !== 'trackside') restoreFov(camera);
    if (mode !== 'top' && mode !== 'free') return void (placed.current = null);
    // Dragging a track point moves the bounds on every update. Re-framing then would slide the map out from under the pointer.
    // New controls still get aimed, since the map controls replace the orbit ones a render after the mode changes.
    const key = `${mode}:${track.spec.id}`;
    if (editing && placed.current?.key === key && placed.current.controls === controls) return;
    placed.current = { key, controls };
    camera.position.set(center.x, center.size * 1.05 + 40, center.z + 0.01);
    camera.lookAt(center.x, 0, center.z);
    // The map controls aim at their own target. Left at the old center, a camera now on its far side turns the map upside down.
    controls?.target?.set(center.x, 0, center.z);
    controls?.update?.();
  }, [mode, camera, center, chase, editing, track.spec.id, controls]);

  useFrame((_, rawDt) => {
    // The springs are stable for any step, so only a real stall (a hidden tab) is clamped; a slow GPU still keeps up.
    const dt = Math.min(rawDt, 1);
    if (mode === 'chase') {
      stepChase(chase, frame, camera, dt);
      target.current?.copy(frame.focusPos);
    } else if (mode === 'top' || mode === 'free') {
      if (mode === 'free') keepAboveGround(camera, world, 2);
      target.current?.set(camera.position.x, 0, camera.position.z - 30);
    }
  }, FRAME_PRIORITY.camera);

  if (mode === 'orbit') return <OrbitCam world={world} target={target} />;
  if (mode === 'trackside') return <TracksideCam world={world} target={target} />;
  if (mode === 'free') return <MapControls makeDefault enableDamping screenSpacePanning={false} maxPolarAngle={Math.PI / 2.1} minDistance={10} maxDistance={1500} />;
  if (mode === 'top') return <MapControls makeDefault enableRotate={false} screenSpacePanning minDistance={20} maxDistance={1500} />;
  return null;
}

export function cameraLabel(mode: CameraMode): string {
  return { chase: 'Chase', orbit: 'Orbit', trackside: 'Trackside', top: 'Top down', free: 'Free' }[mode];
}

export function useCameraMode(): CameraMode {
  return useRacingLab((s) => (s.editingTrack ? 'top' : s.camera));
}
