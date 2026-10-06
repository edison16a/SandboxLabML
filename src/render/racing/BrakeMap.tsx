'use client';

import * as THREE from 'three';
import { useRacingLab } from '@/features/racing/state/labStore';
import { useDisposable } from '@/render/shared/useDisposable';
import { brakeMapGeometry } from './brakeMapGeometry';
import { useRacingScene } from './sceneContext';

/** The brake map strip, shown with the ghosts. Colors match the ghost age ramp. */
export function BrakeMap() {
  const { track } = useRacingScene();
  const telemetry = useRacingLab((s) => s.telemetry);
  const visible = useRacingLab((s) => s.brakeMap && s.view !== 'population');
  const geometry = useDisposable(() => brakeMapGeometry(track, telemetry), [track, telemetry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} visible={visible} renderOrder={1}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.85} toneMapped={false} />
    </mesh>
  );
}
