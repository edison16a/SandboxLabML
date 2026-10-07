'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { useMemo } from 'react';
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

/** What auto clear was before the contact shadows drew, shared by the two hooks around them. */
type Saved = { autoClear: boolean };

/**
 * Turns the renderer's auto clear on just before the contact shadows draw
 * (priority below theirs). The effect composer switches it off for the
 * whole renderer, and the shadow target then kept every earlier frame:
 * agents left dark trails and a moved box its old shadow.
 */
function ClearBefore({ saved }: { saved: Saved }) {
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    saved.autoClear = gl.autoClear;
    gl.autoClear = true;
  }, -0.1);
  return null;
}

/** Puts auto clear back once the contact shadows have drawn: same priority as theirs, mounted after them. */
function RestoreAfter({ saved }: { saved: Saved }) {
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    gl.autoClear = saved.autoClear;
  });
  return null;
}

/** The soft shadows under crates and agents, the same in the showcase arena and the Sandbox. Off at low quality. */
export function ArenaContactShadows({ tier }: { tier: HsQualityTier }) {
  const saved = useMemo<Saved>(() => ({ autoClear: true }), []);
  if (tier === 'low') return null;
  return (
    <>
      <ClearBefore saved={saved} />
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
      <RestoreAfter saved={saved} />
    </>
  );
}
