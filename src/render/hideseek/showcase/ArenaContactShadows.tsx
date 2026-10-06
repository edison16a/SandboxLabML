'use client';

import * as THREE from 'three';
import { ContactShadows } from '@react-three/drei';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import type { HsQualityTier } from '@/features/hideseek/state/types';

const SIZE = DEFAULT_HIDESEEK_PHYSICS.arena.size;

/**
 * Contact shadows look up from their plane and darken whatever they see
 * close above it. Crates and agents stand exactly on the floor, so from a
 * camera at plane height their bottom faces sit right on the near plane
 * and their sides are seen edge on: the shadow comes out empty. Dropping
 * the shadow camera a few centimeters below the floor, while the shadow
 * itself stays drawn just above it, lets the camera see those bottoms.
 * The group is turned a quarter turn about x, so its local +z points down.
 */
function lowerShadowCamera(group: THREE.Group | null): void {
  const camera = group?.children.find((c) => (c as THREE.OrthographicCamera).isOrthographicCamera);
  if (camera) camera.position.z = 0.03;
}

/** The soft shadows under crates and agents, the same in the showcase arena and the Sandbox. Off at low quality. */
export function ArenaContactShadows({ tier }: { tier: HsQualityTier }) {
  if (tier === 'low') return null;
  return (
    <ContactShadows
      ref={lowerShadowCamera}
      position={[0, 0.004, 0]}
      scale={SIZE}
      resolution={tier === 'ultra' ? 1024 : 512}
      far={1.8}
      blur={2.2}
      opacity={0.5}
      color="#2a2219"
      frames={Infinity}
    />
  );
}
