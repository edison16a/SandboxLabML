'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AGENT_X, AGENT_Z, FLAG_AIRBORNE, FLAG_CLIMBING, FLAG_FROZEN, FLAG_SEEING, FLAG_SEEN } from '@/engine/hideseek/snapshot';
import { useDisposable } from '@/render/shared/useDisposable';
import { TEAM_BODY } from '../characters/characterMaterials';
import { SLOPE_LEAN } from '../characters/motion/body';
import { instancedCharacterGeometry } from '../characters/instancedCharacter';
import { useHsScene } from '../frame/sceneContext';
import { agentAt, agentFlags, blendAgentPose, hasFlag } from '../frame/snapshotRead';
import { arenaOrigin } from '../layout/gridLattice';
import { HS } from '../palette';
import { cadence } from '../characters/motion/gait';
import { crowdGaitMaterial, gaitAttribute } from './crowdGait';
import { commit, GRID_LAYER, makeScratch, MAX_ARENAS } from './scratch';

const BODY = [TEAM_BODY.hider, TEAM_BODY.seeker];
const WHITE = new THREE.Color('#ffffff');
/** Snapshots arrive at 30 Hz, so a step between two of them over this gives a speed. */
const SNAPSHOT_SECONDS = 1 / 30;

/**
 * Hiders and seekers of every grid arena in one instanced draw call, the
 * hider of slot k at instance 2k and its seeker at 2k + 1. They are the
 * same characters as up close, in a coarse mesh: they walk with swinging
 * legs and arms at the cadence of their real speed, lean into a run, a
 * seen hider flashes paler, a frozen seeker (prep) fades to grey and
 * a seeker with the hider in sight glows brighter. They rise up ramps and
 * through jumps, leaning into a slope like the close up character.
 */
export function GridAgents({ onPick }: { onPick: (slot: number) => void }) {
  const { frame } = useHsScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const built = useDisposable(() => {
    const geometry = instancedCharacterGeometry();
    const gait = gaitAttribute(MAX_ARENAS * 2);
    geometry.setAttribute('aGait', gait);
    return { geometry, gait, dispose: () => geometry.dispose() };
  }, []);
  const material = useDisposable(() => crowdGaitMaterial({ roughness: 0.28, metalness: 0, envMapIntensity: 1.1 }), []);
  const t = useMemo(() => ({ ...makeScratch(), e: new THREE.Euler(0, 0, 0, 'YXZ'), phase: new Float32Array(MAX_ARENAS * 2) }), []);

  useFrame(({ clock }, dt) => {
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
        blendAgentPose(prev, curr, o, frame.alpha, t.pose);
        const flags = agentFlags(curr, o);
        const frozen = hasFlag(flags, FLAG_FROZEN);
        const climbing = hasFlag(flags, FLAG_CLIMBING);
        const step = prev && prev.length > o + AGENT_Z ? Math.hypot(curr[o + AGENT_X] - prev[o + AGENT_X], curr[o + AGENT_Z] - prev[o + AGENT_Z]) : 0;
        const speed = step < 1 ? step / SNAPSHOT_SECONDS : 0;
        const run = Math.min(1, speed / 3);
        const airborne = hasFlag(flags, FLAG_AIRBORNE);
        // Legs and arms swing in the shader at the cadence the real speed sets, and the body rises with each step.
        const stride = (t.phase[n] = (t.phase[n] + Math.min(dt, 0.1) * cadence(speed) * Math.PI * 2) % (Math.PI * 2));
        built.gait.setXY(n, stride, frozen || airborne ? 0 : Math.min(0.6, speed * 0.22) * (climbing ? 0.6 : 1));
        const idle = time * 2.1 + k * 1.3 + a * 2;
        const bob = frozen ? 0 : (1 - run) * (0.006 + Math.sin(idle) * 0.006) + run * Math.abs(Math.sin(stride)) * 0.035;
        const lean = climbing ? SLOPE_LEAN : airborne ? 0.12 : run * 0.14;
        t.e.set(0, t.pose.yaw, -lean);
        t.q.setFromEuler(t.e);
        t.p.set(t.o.x + t.pose.x, bob + t.pose.elevation, t.o.z + t.pose.z);
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
    built.gait.needsUpdate = true;
  });

  return (
    <instancedMesh
      layers={GRID_LAYER}
      ref={mesh}
      args={[built.geometry, material, MAX_ARENAS * 2]}
      frustumCulled={false}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) onPick(e.instanceId >> 1);
      }}
    />
  );
}
