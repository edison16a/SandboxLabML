'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Rect } from '@/engine/hideseek/layouts/types';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { FLAG_FROZEN, FLAG_SEEING } from '@/engine/hideseek/snapshot';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { hasFlag } from '../frame/snapshotRead';
import { HS } from '../palette';
import { createConeMaterial } from '../showcase/coneMaterial';
import { VisionWedge, WEDGE_SEGMENTS } from '../showcase/VisionWedge';
import { readPlayer, sandboxFrame, sandboxSight, seekerIdle } from './sandboxRead';

const VISION = DEFAULT_HIDESEEK_PHYSICS.vision;
const HEIGHT = 1.05;

/**
 * One seeker's field of view as a glowing wedge that stops at walls and
 * boxes, like the showcase cone. Hidden during prep, when seekers are
 * blind; brighter while it has a hider in sight.
 */
function SeekerCone({ slot, walls, fade }: { slot: number; walls: Rect[]; fade: number }) {
  const { frame } = useHsScene();
  const mesh = useRef<THREE.Mesh>(null);
  const wedge = useDisposable(() => new VisionWedge(VISION.fov, VISION.range, HEIGHT), []);
  const material = useDisposable(() => createConeMaterial(HS.seeker, HEIGHT), []);
  const state = useMemo(() => ({ pose: { x: 0, z: 0, yaw: 0 }, d: new Float32Array(WEDGE_SEGMENTS + 1), glow: 0 }), []);

  useFrame((_, dt) => {
    const m = mesh.current;
    const curr = sandboxFrame(frame);
    if (!m) return;
    const flags = curr ? readPlayer(frame, curr, slot, state.pose) : FLAG_FROZEN;
    m.visible = !!curr && !seekerIdle(curr, flags);
    if (!m.visible || !curr) return;
    const { x, z, yaw } = state.pose;
    for (let k = 0; k <= WEDGE_SEGMENTS; k++) {
      const a = yaw + wedge.angle(k);
      state.d[k] = sandboxSight(walls, curr, x, z, Math.cos(a), -Math.sin(a), VISION.range);
    }
    wedge.update(state.d);
    m.position.set(x, 0, z);
    m.rotation.y = yaw;
    const target = (hasFlag(flags, FLAG_SEEING) ? 1.4 : 0.75) * fade;
    state.glow += (target - state.glow) * Math.min(1, dt * 6);
    material.uniforms.uOpacity.value = state.glow;
  });

  return <mesh ref={mesh} geometry={wedge.geometry} material={material} renderOrder={5} raycast={() => null} visible={false} />;
}

/**
 * A vision cone for every seeker in the match. Each is a little fainter
 * than the single showcase cone, and fainter still in a crowd, so eight
 * overlapping cones tint the floor instead of flooding it.
 */
export function SandboxCones({ first, count, walls }: { first: number; count: number; walls: Rect[] }) {
  const fade = Math.min(1, 2 / Math.sqrt(Math.max(1, count)));
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <SeekerCone key={first + i} slot={first + i} walls={walls} fade={fade} />
      ))}
    </group>
  );
}
