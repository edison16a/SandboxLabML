'use client';

import type * as THREE from 'three';
import { Environment } from '@react-three/drei';
import type { QualityTier } from '@/features/racing/state/labStore';
import { Highlights, ReflectedGround } from './environmentShapes';
import { SUN_DIR } from './world/atmosphere';
import { SunLight } from './world/lighting/SunLight';
import { SkyDome } from './world/sky/SkyDome';

interface Props {
  tier: QualityTier;
  /** World position the shadow box follows (the camera target). */
  focus: React.RefObject<THREE.Vector3>;
}

/** Cloud octaves per tier: the sky covers much of the screen, so Low keeps it cheap. */
const OCTAVES = { low: 3, medium: 5, high: 6 } as const;

/**
 * Sky, image based lighting and the sun. The environment map is rendered
 * once from the same procedural sky plus a ring of hills and the warm
 * ground, so paint and glass reflect the world they drive through with no
 * HDR download. Terrain, trees and buildings take their ambient light from
 * it too, which is what gives shade its blue tint.
 */
export function RacingEnvironment({ tier, focus }: Props) {
  return (
    <>
      <SkyDome octaves={OCTAVES[tier]} />
      <Environment resolution={tier === 'high' ? 512 : tier === 'medium' ? 256 : 128} frames={1} environmentIntensity={0.55}>
        <SkyDome octaves={OCTAVES[tier]} follow={false} radius={900} />
        <ReflectedGround />
        {tier !== 'low' && <Highlights sun={SUN_DIR} />}
      </Environment>
      <SunLight tier={tier} focus={focus} />
    </>
  );
}
