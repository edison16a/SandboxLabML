'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { pathPoint } from '@/engine/driving/geometry/path';
import { DEST_HALF, type Route } from '@/engine/driving/route/route';
import { useDisposable } from '@/render/shared/useDisposable';
import { SENSOR } from './palette';

const beamVertex = /* glsl */ `
varying float vH;
void main() {
  vH = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const beamFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uPulse;
varying float vH;
void main() {
  float a = (1.0 - smoothstep(0.0, 9.0, vH)) * 0.32 * uPulse;
  gl_FragColor = vec4(uColor * a, a);
}`;

/**
 * Where the trip ends: the stopping zone outlined on the lane, with a soft
 * column of light rising from it so it can be found from down the street.
 */
export function Destination({ route }: { route: Route }) {
  const place = useMemo(() => {
    const p = route.path.sample(route.destS, pathPoint());
    return { x: p.x, z: -p.y, yaw: Math.atan2(p.ty, p.tx) };
  }, [route]);
  const built = useDisposable(() => {
    const zone = new THREE.EdgesGeometry(new THREE.PlaneGeometry(DEST_HALF * 2, 3.1).rotateX(-Math.PI / 2));
    const zoneFill = new THREE.PlaneGeometry(DEST_HALF * 2, 3.1).rotateX(-Math.PI / 2);
    const beam = new THREE.CylinderGeometry(1.25, 1.25, 9, 32, 1, true).translate(0, 4.5, 0);
    const lineMat = new THREE.LineBasicMaterial({ color: SENSOR.route, transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const fillMat = new THREE.MeshBasicMaterial({ color: SENSOR.route.clone().multiplyScalar(0.12), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const beamMat = new THREE.ShaderMaterial({ vertexShader: beamVertex, fragmentShader: beamFragment, uniforms: { uColor: { value: SENSOR.route }, uPulse: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    return { zone, zoneFill, beam, lineMat, fillMat, beamMat, dispose: () => [zone, zoneFill, beam, lineMat, fillMat, beamMat].forEach((x) => x.dispose()) };
  }, []);
  useFrame(({ clock }) => void (built.beamMat.uniforms.uPulse.value = 0.8 + 0.2 * Math.sin(clock.elapsedTime * 2.2)));
  return (
    <group position={[place.x, 0.04, place.z]} rotation-y={place.yaw}>
      <lineSegments geometry={built.zone} material={built.lineMat} renderOrder={5} />
      <mesh geometry={built.zoneFill} material={built.fillMat} renderOrder={4} />
      <mesh geometry={built.beam} material={built.beamMat} renderOrder={6} />
    </group>
  );
}
