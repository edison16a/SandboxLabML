'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { FLAG_CRUSHED, NAV_DIED } from '@/engine/navigation/agent';
import { SNAP_FLAGS, SNAP_STATUS, SNAP_STOP_TIME } from '@/engine/navigation/snapshot';
import { useDisposable } from '@/render/shared/useDisposable';
import { POSE_PRIORITY, useNavScene } from '../frame/sceneContext';
import { STRIDE } from '../frame/snapshotRead';
import { NAV_COLORS } from '../palette';

/** Seconds the ring takes to spread and fade, and how wide it gets, m. */
const LENGTH = 0.9;
const REACH = 2.2;
const SPIKES = new THREE.Color(NAV_COLORS.senseSpikes).multiplyScalar(1.3);
const MOVER = new THREE.Color(NAV_COLORS.senseMover).multiplyScalar(1.3);

/**
 * A quick ring that spreads over the floor from where the followed runner
 * dies, red on spikes and amber under a mover, so the moment reads even in
 * a busy pack. Simulation time, like the fall it marks.
 */
export function DeathFlash() {
  const { frame } = useNavScene();
  const ring = useRef<THREE.Mesh>(null);
  const material = useDisposable(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), []);
  const state = useMemo(() => ({ at: -99, who: -1, epoch: Number.NaN }), []);

  useFrame(() => {
    const r = ring.current;
    const curr = frame.curr;
    if (!r) return;
    if (frame.epoch !== state.epoch) {
      state.epoch = frame.epoch;
      state.who = -1;
      state.at = -99;
    }
    const i = frame.leader;
    if (curr && i >= 0 && i !== state.who) {
      const o = i * STRIDE;
      if (curr[o + SNAP_STATUS] === NAV_DIED && frame.time - curr[o + SNAP_STOP_TIME] < 0.3) {
        state.who = i;
        state.at = curr[o + SNAP_STOP_TIME];
        material.color.copy(curr[o + SNAP_FLAGS] & FLAG_CRUSHED ? MOVER : SPIKES);
        r.position.set(frame.leaderPose.x, 0.025, frame.leaderPose.z);
      }
    }
    // Timed from the episode clock, so it plays out with the fall and holds when the run is paused.
    const k = Math.min(1, Math.max(0, frame.time - state.at) / LENGTH);
    r.visible = k < 1;
    r.scale.setScalar(0.35 + k * REACH);
    material.opacity = 0.95 * (1 - k) * (1 - k);
  }, POSE_PRIORITY);

  return (
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} material={material} visible={false} renderOrder={3} raycast={() => null}>
      <ringGeometry args={[0.8, 1, 64]} />
    </mesh>
  );
}
