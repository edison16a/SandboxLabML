'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { NAV_FINISHED } from '@/engine/navigation/agent';
import { SNAP_STATUS, SNAP_STOP_TIME } from '@/engine/navigation/snapshot';
import { useDisposable } from '@/render/shared/useDisposable';
import { POSE_PRIORITY, useNavScene } from '../frame/sceneContext';
import { STRIDE } from '../frame/snapshotRead';
import { NAV_COLORS } from '../palette';
import { ConfettiCloud } from './confetti';

/** The agent that finished first, or -1. */
function firstFinisher(curr: Float32Array, count: number): number {
  let best = -1;
  let at = Infinity;
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    if (curr[o + SNAP_STATUS] === NAV_FINISHED && curr[o + SNAP_STOP_TIME] < at) {
      at = curr[o + SNAP_STOP_TIME];
      best = i;
    }
  }
  return best;
}

/**
 * A small celebration when the winner, followed by the view, crosses the line: a puff of
 * confetti from the gate's beam over where it crossed, and a ring of light
 * that spreads across the floor from its feet. It plays once per episode,
 * on simulation time, so it keeps pace at any watch speed.
 */
export function FinishBurst() {
  const { frame } = useNavScene();
  const cloud = useDisposable(() => new ConfettiCloud(160), []);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useDisposable(() => new THREE.MeshBasicMaterial({ color: NAV_COLORS.finishGlow, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), []);
  const state = useMemo(() => ({ won: false, epoch: Number.NaN, ringAge: 99 }), []);

  useFrame(() => {
    const sim = frame.simDt;
    const curr = frame.curr;
    const course = frame.course;
    if (frame.epoch !== state.epoch) {
      state.epoch = frame.epoch;
      state.won = false;
      cloud.clear();
      state.ringAge = 99;
    }
    const i = frame.leader;
    const finished = curr !== null && i >= 0 && curr[i * STRIDE + SNAP_STATUS] === NAV_FINISHED;
    // Once per episode, for the winner: the first one over the line, seen as it happens.
    const fresh = finished && !state.won && frame.time - (curr as Float32Array)[i * STRIDE + SNAP_STOP_TIME] < 0.6 && firstFinisher(curr as Float32Array, frame.count) === i;
    if (course && fresh) {
      state.won = true;
      cloud.burst(course.finishX, 3.1, frame.leaderPose.z, course.halfWidth - 0.6);
      ring.current?.position.set(frame.leaderPose.x, 0.02, frame.leaderPose.z);
      state.ringAge = 0;
    }
    cloud.step(sim);
    state.ringAge += sim;
    const r = ring.current;
    if (r) {
      const k = Math.min(1, state.ringAge / 0.9);
      r.visible = k < 1;
      r.scale.setScalar(0.4 + k * 4.2);
      ringMat.opacity = 0.75 * (1 - k) * (1 - k);
    }
  }, POSE_PRIORITY);

  return (
    <group>
      <primitive object={cloud.mesh} />
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} material={ringMat} visible={false} renderOrder={3} raycast={() => null}>
        <ringGeometry args={[0.92, 1, 64]} />
      </mesh>
    </group>
  );
}
