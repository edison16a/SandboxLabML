'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { useCallback, useMemo, useRef } from 'react';
import { configureTextBuilder } from 'troika-three-text';
import { FLAG_SEEN } from '@/engine/hideseek/snapshot';
import { useHsScene, type HsFrame } from '../frame/sceneContext';
import { agentAt, agentFlags, blendAgentPose, hasFlag, type AgentPose } from '../frame/snapshotRead';
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

/** Top of a hider's head over its feet, m. The word floats just above it and rises with a hider up a ramp. */
const HEAD = 1.55;
/** Font size of the word, m, before it is scaled to the screen. */
const FONT = 0.46;
/** Capital height of the font as a share of its size. */
const CAP = 0.72;
/**
 * Capital height of the word on screen, px. It is scaled with the camera's
 * distance to stay this size, so a close view never fills a third of the
 * screen with it and a far one still reads.
 */
const CAP_PX = 30;
/** Half the word's size on screen, as multiples of CAP_PX: across (four wide letters) and up (with the outline). */
const HALF_W = 2.5;
const HALF_H = 0.75;
/** Highest the word may sit, in screen units from the middle (1 is the top edge), clear of the top HUD row. */
const TOP = 0.9;
/** Pushed past 1 so bloom gives the word a glow. */
const RED = new THREE.Color('#ff5f6d').multiplyScalar(2.4);

/**
 * Where a hider stands in the frame on screen and how high, written into
 * `out`, and whether a seeker has it in sight right now. Each scene reads
 * its own stream: the showcase arena snapshot, or a Sandbox frame by slot.
 */
export type SeenReader = (frame: HsFrame, out: AgentPose) => boolean;

/**
 * "SEEN" floating over a hider whenever a seeker has it in sight. It
 * always faces the camera, pops in with a small overshoot and fades out.
 * It is drawn on the main camera's extra layer only, so the first person
 * views never show a word turned toward another camera. It keeps one size
 * on screen (see place) and draws over walls, like the silhouette of the
 * hider it marks. `scale` shrinks it in a crowd.
 */
export function SeenWord({ read, scale = 1 }: { read: SeenReader; scale?: number }) {
  const { frame } = useHsScene();
  const group = useRef<THREE.Group>(null);
  const state = useMemo(() => ({ pose: { x: 0, z: 0, yaw: 0, elevation: 0 }, show: 0, since: 0, at: new THREE.Vector3() }), []);

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
    const k = place(g, state.at, state.pose, three.camera as THREE.PerspectiveCamera, three.size, scale);
    g.scale.setScalar(pop * (0.5 + 0.5 * state.show) * k);
  });

  return (
    <group ref={group} visible={false}>
      <Billboard>
        <Text layers={GRID_LAYER} font={SDF_FONT} fontSize={FONT} letterSpacing={0.12} color={RED} outlineWidth={0.018} outlineColor="#200509" anchorX="center" anchorY="middle" characters="SEN" material-toneMapped={false} material-depthTest={false} renderOrder={10}>
          SEEN
        </Text>
      </Billboard>
    </group>
  );
}

/**
 * Puts the word just over the hider's head, kept inside the screen, and
 * returns the scale that makes its capitals CAP_PX tall there. Works in
 * screen space, so a hider at the top edge never has its word cut off.
 * `at` is scratch; nothing is allocated.
 */
function place(g: THREE.Group, at: THREE.Vector3, pose: AgentPose, camera: THREE.PerspectiveCamera, size: { width: number; height: number }, scale: number): number {
  at.set(pose.x, pose.elevation + HEAD, pose.z);
  g.parent?.localToWorld(at);
  const distance = Math.max(0.5, at.distanceTo(camera.position));
  const pxPerM = size.height / (2 * distance * Math.tan((camera.fov * Math.PI) / 360));
  const px = CAP_PX * scale;
  const k = px / (CAP * FONT * pxPerM);
  // Lift it by a little over half its own height, so its bottom clears the head.
  at.y += (px * 0.9) / pxPerM;
  at.project(camera);
  if (at.z < 1) {
    const hx = (2 * HALF_W * px) / Math.max(1, size.width);
    const hy = (2 * HALF_H * px) / Math.max(1, size.height);
    at.x = Math.min(1 - hx, Math.max(-1 + hx, at.x));
    at.y = Math.min(TOP - hy, Math.max(-1 + hy, at.y));
  }
  at.unproject(camera);
  g.parent?.worldToLocal(at);
  g.position.copy(at);
  return k;
}

/** SEEN over the hider of one arena in the arena stream. */
export function SeenBillboard({ arena }: { arena: number }) {
  const read = useCallback<SeenReader>(
    (frame, out) => {
      const curr = frame.curr;
      if (!curr) return false;
      const o = agentAt(arena, 0);
      blendAgentPose(frame.prev, curr, o, frame.alpha, out);
      return hasFlag(agentFlags(curr, o), FLAG_SEEN);
    },
    [arena],
  );
  return <SeenWord read={read} />;
}
