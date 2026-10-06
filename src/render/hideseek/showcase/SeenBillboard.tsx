'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { FLAG_SEEN } from '@/engine/hideseek/snapshot';
import { useHsScene } from '../frame/sceneContext';
import { agentAt, blendFloorPose, hasFlag } from '../frame/snapshotRead';

/**
 * The SDF font for 3D text, served from the app itself. Without one, the
 * text renderer would fetch fonts from a CDN, which the content security
 * policy blocks and which would break offline.
 */
export const SDF_FONT = '/fonts/Geist-SemiBold.ttf';

/** Pushed past 1 so bloom gives the word a glow. */
const RED = new THREE.Color('#ff5f6d').multiplyScalar(2.4);

/**
 * "SEEN" floating over the hider whenever the seeker has it in sight. It
 * always faces the camera, pops in with a small overshoot and fades out.
 */
export function SeenBillboard({ arena }: { arena: number }) {
  const { frame } = useHsScene();
  const group = useRef<THREE.Group>(null);
  const state = useMemo(() => ({ pose: { x: 0, z: 0, yaw: 0 }, show: 0, since: 0 }), []);

  useFrame((_, dt) => {
    const g = group.current;
    const curr = frame.curr;
    if (!g || !curr) return;
    const o = agentAt(arena, 0);
    const seen = hasFlag(curr[o + 3], FLAG_SEEN);
    blendFloorPose(frame.prev, curr, o, frame.alpha, state.pose);
    state.since = seen ? state.since + dt : 0;
    state.show += ((seen ? 1 : 0) - state.show) * Math.min(1, dt * 14);
    g.visible = state.show > 0.02;
    if (!g.visible) return;
    // A short overshoot when the word appears: 0.7 to about 1.12 and back to 1 in a quarter second.
    const t = Math.min(1, state.since / 0.25);
    const pop = seen ? 0.7 + 0.3 * t + 0.42 * Math.sin(t * Math.PI) * (1 - t) : 1;
    g.position.set(state.pose.x, 2.3, state.pose.z);
    g.scale.setScalar(pop * (0.5 + 0.5 * state.show));
  });

  return (
    <group ref={group} visible={false}>
      <Billboard>
        <Text font={SDF_FONT} fontSize={0.46} letterSpacing={0.12} color={RED} outlineWidth={0.018} outlineColor="#200509" anchorX="center" anchorY="middle" characters="SEN" material-toneMapped={false}>
          SEEN
        </Text>
      </Billboard>
    </group>
  );
}
