'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { FLAG_FROZEN, FLAG_SEEING, FLAG_SEEN } from '@/engine/hideseek/snapshot';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { agentAt, blendFloorPose, hasFlag } from '../frame/snapshotRead';
import { arenaOrigin } from '../layout/gridLattice';
import { teamColor } from '../palette';
import { gridAgentGeometry } from './gridGeometry';
import { commit, makeScratch, MAX_ARENAS, placeInstance, GRID_LAYER } from './scratch';

const WHITE = new THREE.Color('#ffffff');

/**
 * Hiders and seekers of every grid arena in one instanced draw call, the
 * hider of slot k at instance 2k and its seeker at 2k + 1. A seen hider
 * flashes paler, a frozen seeker (prep) is dimmed and a seeker that has the
 * hider in sight glows brighter.
 */
export function GridAgents({ onPick }: { onPick: (slot: number) => void }) {
  const { frame } = useHsScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useDisposable(() => gridAgentGeometry(), []);
  const material = useDisposable(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05 }), []);
  const t = useMemo(() => makeScratch(), []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const curr = frame.curr;
    if (!curr || frame.count <= 1) return commit(m, 0);
    let n = 0;
    for (let k = 0; k < frame.count; k++) {
      const arena = frame.first + k;
      arenaOrigin(k, frame.lattice, t.o);
      const hide = k === frame.focusSlot ? 0 : 1;
      const dim = k === frame.focusSlot ? 1 : frame.dim;
      for (let a = 0; a < 2; a++) {
        const o = agentAt(arena, a);
        blendFloorPose(frame.prev, curr, o, frame.alpha, t.pose);
        placeInstance(m, n, t, t.o.x + t.pose.x, 0, t.o.z + t.pose.z, t.pose.yaw, hide, hide, hide);
        const flags = curr[o + 3];
        t.c.copy(teamColor(a));
        if (a === 0 && hasFlag(flags, FLAG_SEEN)) t.c.lerp(WHITE, 0.35);
        if (a === 1 && hasFlag(flags, FLAG_FROZEN)) t.c.multiplyScalar(0.45);
        if (a === 1 && hasFlag(flags, FLAG_SEEING)) t.c.multiplyScalar(1.25);
        m.setColorAt(n++, t.c.multiplyScalar(dim));
      }
    }
    commit(m, n);
  });

  return (
    <instancedMesh layers={GRID_LAYER}
      ref={mesh}
      args={[geometry, material, MAX_ARENAS * 2]}
      frustumCulled={false}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) onPick(e.instanceId >> 1);
      }}
    />
  );
}
