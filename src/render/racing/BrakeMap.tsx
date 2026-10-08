'use client';

import * as THREE from 'three';
import { placedTelemetry, useRacingLab } from '@/features/racing/state/labStore';
import { useDisposable } from '@/render/shared/useDisposable';
import { brakeMapGeometry } from './brakeMapGeometry';
import { useRacingScene } from './sceneContext';

/**
 * The brake map strip, shown with the ghosts when it is switched on in the
 * ghost menu. It reads as paint on the run-off: lit by the sun like the
 * grass under it, rough, half see through, and pulled toward the camera in
 * depth instead of lifted, so it never floats. Colors match the ghost age
 * ramp.
 */
export function BrakeMap() {
  const { track } = useRacingScene();
  const telemetry = useRacingLab(placedTelemetry);
  const visible = useRacingLab((s) => s.brakeMap && s.view !== 'population');
  const geometry = useDisposable(() => brakeMapGeometry(track, telemetry), [track, telemetry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} visible={visible} renderOrder={1} receiveShadow>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.62} roughness={0.9} metalness={0} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}
