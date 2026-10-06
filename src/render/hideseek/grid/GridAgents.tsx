'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { FLAG_FROZEN, FLAG_SEEING, FLAG_SEEN } from '@/engine/hideseek/snapshot';
import { useDisposable } from '@/render/shared/useDisposable';
import { TEAM_BODY } from '../characters/characterMaterials';
import { instancedCharacterGeometry } from '../characters/instancedCharacter';
import { useHsScene } from '../frame/sceneContext';
import { agentAt, agentFlags, blendFloorPose, hasFlag } from '../frame/snapshotRead';
import { arenaOrigin } from '../layout/gridLattice';
import { HS } from '../palette';
import { commit, GRID_LAYER, makeScratch, MAX_ARENAS } from './scratch';
import { tintMaskMaterial } from '../shared/tintMask';

const BODY = [TEAM_BODY.hider, TEAM_BODY.seeker];
const WHITE = new THREE.Color('#ffffff');
/** Snapshots arrive at 30 Hz, so a step between two of them over this gives a speed. */
const SNAPSHOT_SECONDS = 1 / 30;

/**
 * Hiders and seekers of every grid arena in one instanced draw call, the
 * hider of slot k at instance 2k and its seeker at 2k + 1. They are the
 * same characters as up close, in a coarse mesh: they bob, lean into a
 * run, a seen hider flashes paler, a frozen seeker (prep) fades to grey and
 * a seeker with the hider in sight glows brighter.
 */
export function GridAgents({ onPick }: { onPick: (slot: number) => void }) {
  const { frame } = useHsScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useDisposable(() => instancedCharacterGeometry(), []);
  const material = useDisposable(() => tintMaskMaterial({ roughness: 0.28, metalness: 0, envMapIntensity: 1.1 }), []);
  const t = useMemo(() => ({ ...makeScratch(), e: new THREE.Euler(0, 0, 0, 'YXZ') }), []);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const curr = frame.curr;
    const prev = frame.prev;
    if (!curr || frame.count <= 1) return commit(m, 0);
    material.color.setScalar(frame.dim);
    const time = clock.elapsedTime;
    let n = 0;
    for (let k = 0; k < frame.count; k++) {
      const arena = frame.first + k;
      arenaOrigin(k, frame.lattice, t.o);
      const hide = k === frame.focusSlot ? 0 : 1;
      for (let a = 0; a < 2; a++) {
        const o = agentAt(arena, a);
        blendFloorPose(prev, curr, o, frame.alpha, t.pose);
        const flags = agentFlags(curr, o);
        const frozen = hasFlag(flags, FLAG_FROZEN);
        const step = prev && prev.length > o + 1 ? Math.hypot(curr[o] - prev[o], curr[o + 1] - prev[o + 1]) : 0;
        const speed = step < 1 ? step / SNAPSHOT_SECONDS : 0;
        const run = Math.min(1, speed / 3);
        const phase = time * 2.1 + k * 1.3 + a * 2;
        const bob = frozen ? 0 : (1 - run) * (0.006 + Math.sin(phase) * 0.006) + run * Math.abs(Math.sin(time * 9 + k)) * 0.05;
        t.e.set(0, t.pose.yaw, -run * 0.2);
        t.q.setFromEuler(t.e);
        t.p.set(t.o.x + t.pose.x, bob, t.o.z + t.pose.z);
        t.s.setScalar(hide);
        m.setMatrixAt(n, t.m.compose(t.p, t.q, t.s));
        t.c.copy(BODY[a]);
        if (a === 0 && hasFlag(flags, FLAG_SEEN)) t.c.lerp(WHITE, 0.4);
        if (frozen) t.c.lerp(HS.dormant, 0.55);
        if (a === 1 && hasFlag(flags, FLAG_SEEING)) t.c.multiplyScalar(1.2);
        m.setColorAt(n++, t.c);
      }
    }
    commit(m, n);
  });

  return (
    <instancedMesh
      layers={GRID_LAYER}
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
