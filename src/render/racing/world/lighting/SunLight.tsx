'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { QualityTier } from '@/features/racing/state/labStore';
import { ATMOSPHERE, SUN_DIR } from '../atmosphere';

interface Props {
  tier: QualityTier;
  /** World point the shadow box follows (the camera target). */
  focus: React.RefObject<THREE.Vector3>;
}

/** Shadow box half size per tier, m. High covers more road so tree shadows reach across it. */
const SHADOW_BOX = { low: 40, medium: 42, high: 55 } as const;

/**
 * The sun and the sky's fill light. The sun casts the only real shadows,
 * from a box that follows the action; the hemisphere adds blue from above
 * and warm bounce from the dry ground below, the way open country lights
 * a car's flanks.
 */
export function SunLight({ tier, focus }: Props) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const size = SHADOW_BOX[tier];
  const map = tier === 'high' ? 2048 : 1024;
  // One texel of the shadow map in world meters: the box snaps to it so shadows never crawl as the camera moves.
  const texel = (size * 2) / map;

  useFrame(() => {
    const l = light.current;
    const f = focus.current;
    if (!l || !f) return;
    const sx = Math.round(f.x / texel) * texel;
    const sz = Math.round(f.z / texel) * texel;
    target.position.set(sx, 0, sz);
    l.position.set(sx + SUN_DIR.x * 220, SUN_DIR.y * 220, sz + SUN_DIR.z * 220);
    target.updateMatrixWorld();
  });

  return (
    <>
      <hemisphereLight args={['#bcd4f2', '#8a6c42', 0.55]} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={3.1}
        color={ATMOSPHERE.sun}
        castShadow={tier !== 'low'}
        shadow-mapSize={[map, map]}
        shadow-bias={-0.00025}
        shadow-normalBias={0.05}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
        shadow-camera-near={20}
        shadow-camera-far={520}
      />
    </>
  );
}
