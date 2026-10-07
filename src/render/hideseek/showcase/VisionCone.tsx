'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { FLAG_FROZEN, FLAG_SEEING } from '@/engine/hideseek/snapshot';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { agentAt, agentFlags, blendAgentPose, hasFlag } from '../frame/snapshotRead';
import { wallsOfLayout } from '../layout/arenaWalls';
import { castSight, sightMode } from '../overlay/sight2d';
import { HS } from '../palette';
import { createConeMaterial } from './coneMaterial';
import { VisionWedge, WEDGE_SEGMENTS } from './VisionWedge';

const VISION = DEFAULT_HIDESEEK_PHYSICS.vision;
const HEIGHT = 1.05;

/**
 * The seeker's field of view as a glowing wedge that stops at walls and
 * boxes, so it shows exactly what the seeker can see. Hidden during prep,
 * when the seeker is blind; brighter while the hider is in sight.
 */
export function VisionCone({ arena, layout }: { arena: number; layout: number }) {
  const { frame } = useHsScene();
  const mesh = useRef<THREE.Mesh>(null);
  const wedge = useDisposable(() => new VisionWedge(VISION.fov, VISION.range, HEIGHT), []);
  const material = useDisposable(() => createConeMaterial(HS.seeker, HEIGHT), []);
  const state = useMemo(() => ({ pose: { x: 0, z: 0, yaw: 0, elevation: 0 }, d: new Float32Array(WEDGE_SEGMENTS + 1), glow: 0 }), []);

  useFrame((_, dt) => {
    const m = mesh.current;
    const curr = frame.curr;
    if (!m || !curr) return;
    const o = agentAt(arena, 1);
    const flags = agentFlags(curr, o);
    m.visible = !hasFlag(flags, FLAG_FROZEN);
    if (!m.visible) return;
    blendAgentPose(frame.prev, curr, o, frame.alpha, state.pose);
    const { x, z, yaw, elevation } = state.pose;
    const walls = wallsOfLayout(layout);
    const mode = sightMode(curr, arena, 1);
    for (let k = 0; k <= WEDGE_SEGMENTS; k++) {
      const a = yaw + wedge.angle(k);
      state.d[k] = castSight(walls, curr, arena, x, z, Math.cos(a), -Math.sin(a), VISION.range, mode);
    }
    wedge.update(state.d);
    // The cone rides up a ramp and through a jump with the seeker's eyes.
    m.position.set(x, elevation, z);
    m.rotation.y = yaw;
    const target = hasFlag(flags, FLAG_SEEING) ? 1.7 : 1;
    state.glow += (target - state.glow) * Math.min(1, dt * 6);
    material.uniforms.uOpacity.value = state.glow;
  });

  return <mesh ref={mesh} geometry={wedge.geometry} material={material} renderOrder={5} raycast={() => null} />;
}
