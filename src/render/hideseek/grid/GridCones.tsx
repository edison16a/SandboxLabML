'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { FLAG_FROZEN, FLAG_SEEING } from '@/engine/hideseek/snapshot';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { agentAt, agentFlags, blendAgentPose, hasFlag } from '../frame/snapshotRead';
import { arenaOrigin } from '../layout/gridLattice';
import { clipToArenas, createArenaClip, updateArenaClip } from './arenaClip';
import { HS } from '../palette';
import { fanGeometry } from './gridGeometry';
import { commit, makeScratch, MAX_ARENAS, placeInstance, GRID_LAYER } from './scratch';

/**
 * On the grid a cone only has to say where the seeker looks, so it is a
 * short fan that never reaches the next arena, not the full vision range.
 */
const CONE_RADIUS = 5.5;
const WHITE = new THREE.Color('#ffffff');

/**
 * Seeker vision cones for the grid, one instanced draw call, alpha blended
 * so they still show on the pale floors and clipped to each arena's floor:
 * off during prep, a soft pink while searching, full red once the hider is
 * in sight.
 */
export function GridCones() {
  const { frame } = useHsScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useDisposable(() => fanGeometry(CONE_RADIUS, DEFAULT_HIDESEEK_PHYSICS.vision.fov, 18), []);
  const clip = useMemo(() => createArenaClip(), []);
  const material = useDisposable(
    () => clipToArenas(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), clip),
    [clip],
  );
  const t = useMemo(() => makeScratch(), []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const curr = frame.curr;
    if (!curr || frame.count <= 1) return commit(m, 0);
    updateArenaClip(clip, frame.lattice);
    // Every cone drawn here is outside the showcase (its own is hidden), so all dim with the grid.
    material.color.setScalar(frame.dim);
    for (let k = 0; k < frame.count; k++) {
      const arena = frame.first + k;
      const o = agentAt(arena, 1);
      const flags = agentFlags(curr, o);
      arenaOrigin(k, frame.lattice, t.o);
      blendAgentPose(frame.prev, curr, o, frame.alpha, t.pose);
      const off = k === frame.focusSlot || hasFlag(flags, FLAG_FROZEN) ? 0 : 1;
      // The fan rises with a seeker up a ramp, so it never sinks into the slope.
      placeInstance(m, k, t, t.o.x + t.pose.x, 0.04 + t.pose.elevation, t.o.z + t.pose.z, t.pose.yaw, off, 1, off);
      t.c.copy(HS.seeker);
      if (!hasFlag(flags, FLAG_SEEING)) t.c.lerp(WHITE, 0.45);
      m.setColorAt(k, t.c);
    }
    commit(m, frame.count);
  });

  return <instancedMesh layers={GRID_LAYER} ref={mesh} args={[geometry, material, MAX_ARENAS]} frustumCulled={false} renderOrder={3} raycast={() => null} />;
}
