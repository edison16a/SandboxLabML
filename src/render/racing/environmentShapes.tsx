'use client';

import type * as THREE from 'three';
import { Lightformer } from '@react-three/drei';

/**
 * Bright shapes drawn into the environment map only, never on screen: a
 * small panel toward the sun and long thin strips just above the horizon.
 * Car paint is mostly reflection, and these give it crisp highlights that
 * run along its creases. They sit where the sky is already bright, so the
 * scene's overall light barely changes.
 */
export function Highlights({ sun }: { sun: THREE.Vector3 }) {
  const p = sun.clone().multiplyScalar(60);
  return (
    <>
      <Lightformer form="rect" intensity={1.6} color="#fff6e8" position={[p.x, p.y, p.z]} scale={[18, 9, 1]} />
      <Lightformer form="rect" intensity={1.8} position={[0, 6, -60]} scale={[160, 2.2, 1]} />
      <Lightformer form="rect" intensity={1.8} position={[0, 6, 60]} rotation-y={Math.PI} scale={[160, 2.2, 1]} />
      <Lightformer form="rect" intensity={1.2} position={[-60, 9, 0]} rotation-y={Math.PI / 2} scale={[160, 1.6, 1]} />
    </>
  );
}

/**
 * A dark ground under the environment map's horizon. The sky shader keeps
 * glowing below the horizon, so without this every car side mirrors a
 * bright haze. With it, paint picks up the dark ground below a sharp
 * horizon line, the contrast that makes a body look glossy.
 */
export function ReflectedGround() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -3, 0]}>
      <circleGeometry args={[900, 48]} />
      <meshBasicMaterial color="#2c3328" />
    </mesh>
  );
}
