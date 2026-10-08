'use client';

import * as THREE from 'three';
import { Lightformer } from '@react-three/drei';
import { useDisposable } from '@/render/shared/useDisposable';
import { ridged } from './world/noise';

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
      <Lightformer form="rect" intensity={1.6} color="#fff1dc" position={[p.x, p.y, p.z]} scale={[18, 9, 1]} />
      <Lightformer form="rect" intensity={1.5} position={[0, 7, -60]} scale={[160, 2, 1]} />
      <Lightformer form="rect" intensity={1.5} position={[0, 7, 60]} rotation-y={Math.PI} scale={[160, 2, 1]} />
      <Lightformer form="rect" intensity={1} position={[-60, 10, 0]} rotation-y={Math.PI / 2} scale={[160, 1.4, 1]} />
    </>
  );
}

/**
 * The ground and a ring of hills under the environment map's horizon. Car
 * paint mirrors the world around it: the lower body picks up warm dry
 * ground and the flanks a dark band of hills against the bright sky, the
 * sharp horizon line that makes a body look glossy.
 */
export function ReflectedGround() {
  const built = useDisposable(() => {
    const ring = new THREE.CylinderGeometry(700, 700, 1, 96, 1, true);
    const pos = ring.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color('#4d4430');
    const high = new THREE.Color('#6d6a5c');
    for (let i = 0; i < pos.count; i++) {
      const top = pos.getY(i) > 0;
      const a = Math.atan2(pos.getZ(i), pos.getX(i));
      // Ridge heights from the same noise as the real mountains, about 3 to 9 degrees above the horizon.
      const h = 36 + ridged(Math.cos(a) * 3 + 9, Math.sin(a) * 3 + 9, 5, 3) * 80;
      pos.setY(i, top ? h : -4);
      (top ? high : low).toArray(colors, i * 3);
    }
    ring.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const ringMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    const ground = new THREE.CircleGeometry(900, 48).rotateX(-Math.PI / 2).translate(0, -3, 0);
    const groundMat = new THREE.MeshBasicMaterial({ color: '#3b3424', fog: false });
    return { ring, ringMat, ground, groundMat, dispose: () => [ring, ringMat, ground, groundMat].forEach((d) => d.dispose()) };
  }, []);
  return (
    <>
      <mesh geometry={built.ground} material={built.groundMat} />
      <mesh geometry={built.ring} material={built.ringMat} />
    </>
  );
}
