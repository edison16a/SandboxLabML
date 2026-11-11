'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { SNAP_FLAGS, SNAP_STATUS, SNAP_STOP_TIME } from '@/engine/navigation/snapshot';
import { commit, makeScratch, placeInstance } from '@/render/hideseek/grid/scratch';
import { floorQuad } from '@/render/hideseek/shared/basicGeometry';
import { blobTexture } from '@/render/hideseek/shared/blobShadow';
import { useDisposable } from '@/render/shared/useDisposable';
import { POSE_PRIORITY, useNavScene } from '../frame/sceneContext';
import { blendAgent, STRIDE } from '../frame/snapshotRead';
import { NAV_COLORS } from '../palette';
import { MAX_AGENTS } from './CrowdAgents';
import { createStopPose, stopPose } from './stopPose';

const SHADOW = new THREE.Color('#1d1a15');
const FLOOR = new THREE.Color(NAV_COLORS.floor);
/** Width of a runner's shadow, m, and the room round a mover's footprint. */
const RUNNER = 1.25;
const MOVER_PAD = 0.8;

/**
 * Soft round shadows under every crowd runner and every mover, as one
 * instanced draw call of textured quads, for the tier without shadow maps:
 * they are what keep the crowd from floating there. A shadow fades into
 * the floor with its runner, and shrinks as a finisher hops.
 */
export function BlobShadows() {
  const { frame } = useNavScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useDisposable(() => floorQuad(1), []);
  const built = useDisposable(() => {
    const alphaMap = blobTexture();
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff', alphaMap, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    return {
      material,
      dispose: () => {
        alphaMap.dispose();
        material.dispose();
      },
    };
  }, []);
  const t = useMemo(() => ({ ...makeScratch(), floor: { x: 0, z: 0, yaw: 0 }, stop: createStopPose() }), []);

  useFrame(() => {
    const m = mesh.current;
    const curr = frame.curr;
    if (!m) return;
    if (!curr || !frame.course) return commit(m, 0);
    let n = 0;
    const count = Math.min(frame.count, MAX_AGENTS);
    for (let i = 0; i < count; i++) {
      if (i === frame.leader) continue;
      const o = i * STRIDE;
      stopPose(curr[o + SNAP_STATUS], curr[o + SNAP_FLAGS], frame.time - curr[o + SNAP_STOP_TIME], t.stop);
      if (t.stop.alpha <= 0.01 || t.stop.tip !== 0) continue;
      blendAgent(frame.prev, curr, i, frame.alpha, t.floor);
      const size = (RUNNER * t.stop.spread) / (1 + t.stop.lift * 1.5);
      placeInstance(m, n, t, t.floor.x, 0.012, t.floor.z, 0, size, 1, size);
      m.setColorAt(n++, t.c.copy(SHADOW).lerp(FLOOR, 1 - t.stop.alpha));
    }
    const movers = frame.course.movers;
    for (let k = 0; k < movers.length; k++) {
      placeInstance(m, n, t, frame.movers[k * 2], 0.011, frame.movers[k * 2 + 1], 0, movers[k].hx * 2 + MOVER_PAD, 1, movers[k].hz * 2 + MOVER_PAD);
      m.setColorAt(n++, SHADOW);
    }
    commit(m, n);
  }, POSE_PRIORITY);

  return <instancedMesh ref={mesh} args={[geometry, built.material, MAX_AGENTS + 16]} frustumCulled={false} renderOrder={1} raycast={() => null} />;
}
