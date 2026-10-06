'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { Suspense, useMemo, useRef } from 'react';
import { FLAG_SEEN } from '@/engine/hideseek/snapshot';
import { useHsScene } from '../frame/sceneContext';
import { hasFlag } from '../frame/snapshotRead';
import { GRID_LAYER } from '../grid/scratch';
import { SDF_FONT } from '../showcase/SeenBillboard';
import { readPlayer, sandboxFrame } from './sandboxRead';

/** Pushed past 1 so bloom gives the word a glow. */
const RED = new THREE.Color('#ff5f6d').multiplyScalar(2.4);

/**
 * "SEEN" over one hider while any seeker has it in sight: it pops in with a
 * small overshoot and fades out, like the showcase billboard. Drawn on the
 * main camera's extra layer only, so first person views never show it.
 */
function SeenMarker({ slot }: { slot: number }) {
  const { frame } = useHsScene();
  const group = useRef<THREE.Group>(null);
  const state = useMemo(() => ({ pose: { x: 0, z: 0, yaw: 0 }, show: 0, since: 0 }), []);

  useFrame((three, dt) => {
    const g = group.current;
    const curr = sandboxFrame(frame);
    if (!g) return;
    const seen = !!curr && hasFlag(readPlayer(frame, curr, slot, state.pose), FLAG_SEEN);
    state.since = seen ? state.since + dt : 0;
    state.show += ((seen ? 1 : 0) - state.show) * Math.min(1, dt * 14);
    g.visible = state.show > 0.02;
    if (Math.abs((seen ? 1 : 0) - state.show) > 0.01 || (seen && state.since < 0.25)) three.invalidate();
    if (!g.visible) return;
    const t = Math.min(1, state.since / 0.25);
    const pop = seen ? 0.7 + 0.3 * t + 0.42 * Math.sin(t * Math.PI) * (1 - t) : 1;
    g.position.set(state.pose.x, 2.3, state.pose.z);
    g.scale.setScalar(pop * (0.5 + 0.5 * state.show) * 0.85);
  });

  return (
    <group ref={group} visible={false}>
      <Billboard>
        <Text
          layers={GRID_LAYER}
          font={SDF_FONT}
          fontSize={0.46}
          letterSpacing={0.12}
          color={RED}
          outlineWidth={0.018}
          outlineColor="#200509"
          anchorX="center"
          anchorY="middle"
          characters="SEN"
          material-toneMapped={false}
        >
          SEEN
        </Text>
      </Billboard>
    </group>
  );
}

/** A SEEN marker for every hider. */
export function SeenMarkers({ hiders }: { hiders: number }) {
  return (
    <Suspense fallback={null}>
      {Array.from({ length: hiders }, (_, i) => (
        <SeenMarker key={i} slot={i} />
      ))}
    </Suspense>
  );
}
