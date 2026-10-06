'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { useCallback, useMemo, useRef } from 'react';
import { configureTextBuilder } from 'troika-three-text';
import { FLAG_SEEN } from '@/engine/hideseek/snapshot';
import { useHsScene, type HsFrame } from '../frame/sceneContext';
import { agentAt, agentFlags, blendFloorPose, hasFlag, type FloorPose } from '../frame/snapshotRead';
import { GRID_LAYER } from '../grid/scratch';

/**
 * The SDF font for 3D text, served from the app itself. Without one, the
 * text renderer would fetch fonts from a CDN, which the content security
 * policy blocks and which would break offline.
 */
export const SDF_FONT = '/fonts/Geist-SemiBold.ttf';

// The text builder normally runs in a worker that loads its code from blob
// URLs, which the content security policy forbids. Building four glyphs on
// the main thread costs nothing.
configureTextBuilder({ useWorker: false, defaultFontURL: SDF_FONT });

/** Pushed past 1 so bloom gives the word a glow. */
const RED = new THREE.Color('#ff5f6d').multiplyScalar(2.4);

/**
 * Where a hider stands in the frame on screen, written into `out`, and
 * whether a seeker has it in sight right now. Each scene reads its own
 * stream: the showcase arena snapshot, or a Sandbox frame by slot.
 */
export type SeenReader = (frame: HsFrame, out: FloorPose) => boolean;

/**
 * "SEEN" floating over a hider whenever a seeker has it in sight. It
 * always faces the camera, pops in with a small overshoot and fades out.
 * It is drawn on the main camera's extra layer only, so the first person
 * views never show a word turned toward another camera. `scale` shrinks
 * it in a crowd.
 */
export function SeenWord({ read, scale = 1 }: { read: SeenReader; scale?: number }) {
  const { frame } = useHsScene();
  const group = useRef<THREE.Group>(null);
  const state = useMemo(() => ({ pose: { x: 0, z: 0, yaw: 0 }, show: 0, since: 0 }), []);

  useFrame((three, dt) => {
    const g = group.current;
    if (!g || !frame.curr) return;
    const seen = read(frame, state.pose);
    state.since = seen ? state.since + dt : 0;
    state.show += ((seen ? 1 : 0) - state.show) * Math.min(1, dt * 14);
    g.visible = state.show > 0.02;
    // Keep drawing on demand until the pop and the fade have settled.
    if (Math.abs((seen ? 1 : 0) - state.show) > 0.01 || (seen && state.since < 0.25)) three.invalidate();
    if (!g.visible) return;
    // A short overshoot when the word appears: 0.7 to about 1.12 and back to 1 in a quarter second.
    const t = Math.min(1, state.since / 0.25);
    const pop = seen ? 0.7 + 0.3 * t + 0.42 * Math.sin(t * Math.PI) * (1 - t) : 1;
    g.position.set(state.pose.x, 2.3, state.pose.z);
    g.scale.setScalar(pop * (0.5 + 0.5 * state.show) * scale);
  });

  return (
    <group ref={group} visible={false}>
      <Billboard>
        <Text layers={GRID_LAYER} font={SDF_FONT} fontSize={0.46} letterSpacing={0.12} color={RED} outlineWidth={0.018} outlineColor="#200509" anchorX="center" anchorY="middle" characters="SEN" material-toneMapped={false}>
          SEEN
        </Text>
      </Billboard>
    </group>
  );
}

/** SEEN over the hider of one arena in the arena stream. */
export function SeenBillboard({ arena }: { arena: number }) {
  const read = useCallback<SeenReader>(
    (frame, out) => {
      const curr = frame.curr;
      if (!curr) return false;
      const o = agentAt(arena, 0);
      blendFloorPose(frame.prev, curr, o, frame.alpha, out);
      return hasFlag(agentFlags(curr, o), FLAG_SEEN);
    },
    [arena],
  );
  return <SeenWord read={read} />;
}
