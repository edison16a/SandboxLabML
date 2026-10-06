'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Environment, Sky } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { grassTexture } from '@/render/shared/textures';
import type { QualityTier } from '@/features/racing/state/labStore';
import { Highlights, ReflectedGround } from './environmentShapes';

/** Low afternoon sun: long shadows read well and the paint picks up highlights. */
const SUN = new THREE.Vector3(120, 140, 80).normalize();
const HORIZON = '#c4d6ea';

interface Props {
  tier: QualityTier;
  /** World position the shadow box follows (the camera target). */
  focus: React.RefObject<THREE.Vector3>;
}

/**
 * Sky, image based lighting, the sun and the grass. The environment map is
 * rendered from the procedural sky itself, so reflections match the sky with
 * no HDR download.
 *
 * The sky shader works out light scattering for every pixel it covers, and
 * the camera mostly looks at the horizon. On Low that cost goes away: the
 * sky is drawn once into the environment cube, which then doubles as the
 * background. A cube that small softens the sun's disk, which Low can afford.
 */
export function RacingEnvironment({ tier, focus }: Props) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const shadowSize = tier === 'high' ? 2048 : 1024;

  useFrame(() => {
    const l = light.current;
    const f = focus.current;
    if (!l || !f) return;
    // Snap to a coarse grid so the shadow map does not shimmer as the camera moves.
    const sx = Math.round(f.x / 4) * 4;
    const sz = Math.round(f.z / 4) * 4;
    target.position.set(sx, 0, sz);
    l.position.set(sx + SUN.x * 150, SUN.y * 150, sz + SUN.z * 150);
    target.updateMatrixWorld();
  });

  return (
    <>
      <color attach="background" args={[HORIZON]} />
      <fog attach="fog" args={[HORIZON, 320, 1500]} />
      {tier !== 'low' && <Sky distance={4000} sunPosition={SUN.clone().multiplyScalar(100)} turbidity={2.6} rayleigh={1.6} mieCoefficient={0.003} mieDirectionalG={0.82} />}
      <Environment resolution={tier === 'high' ? 512 : tier === 'medium' ? 256 : 128} frames={1} environmentIntensity={0.45} background={tier === 'low'}>
        <Sky distance={4000} sunPosition={SUN.clone().multiplyScalar(100)} turbidity={2.6} rayleigh={1.6} />
        {/* On Low this cube is also the visible background, so it keeps only the sky. */}
        {tier !== 'low' && <ReflectedGround />}
        {tier !== 'low' && <Highlights sun={SUN} />}
      </Environment>
      <hemisphereLight args={['#dbe8ff', '#4d6b3a', 0.35]} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={2.3}
        color="#fff3e0"
        castShadow={tier !== 'low'}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-near={10}
        shadow-camera-far={400}
      />
      <Ground />
    </>
  );
}

/** A large grass plane with a repeating procedural texture. */
function Ground() {
  const map = useMemo(() => {
    const t = grassTexture();
    t.repeat.set(220, 220);
    return t;
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <planeGeometry args={[4000, 4000]} />
      <meshStandardMaterial map={map} roughness={0.95} color="#9cbf86" />
    </mesh>
  );
}
