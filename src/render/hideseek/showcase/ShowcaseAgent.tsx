'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { FLAG_FROZEN, FLAG_SEEING, FLAG_SEEN } from '@/engine/hideseek/snapshot';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { agentAt, blendFloorPose, hasFlag } from '../frame/snapshotRead';
import { teamColor } from '../palette';
import { baseRingGeometry, bodyGeometry, visorGeometry, visorLineGeometry, waistRingGeometry } from './agentGeometry';
import { MotionTrail } from './MotionTrail';

/** Body tints in a softened team color, so a glance tells hiders from seekers even from far away. */
const BODY = ['#8fbcff', '#ff9aa4'];

/** Geometry shared by both agents, built once per showcase. */
export function useAgentGeometry() {
  return useDisposable(() => {
    const g = { body: bodyGeometry(), visor: visorGeometry(), line: visorLineGeometry(), ring: waistRingGeometry(), base: baseRingGeometry() };
    return { ...g, dispose: () => Object.values(g).forEach((x) => x.dispose()) };
  }, []);
}

/**
 * One agent in full detail: a glossy capsule with a dark glass visor that
 * shows its facing, team colored light accents, an idle bob, a lean into
 * its movement and a fading trail on the floor. A frozen seeker (prep) has
 * its lights dimmed; a seen hider pulses.
 */
export function ShowcaseAgent({ arena, agent, geometry }: { arena: number; agent: 0 | 1; geometry: ReturnType<typeof useAgentGeometry> }) {
  const { frame } = useHsScene();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const color = teamColor(agent);
  const mats = useDisposable(() => {
    const list = {
      body: new THREE.MeshStandardMaterial({ color: BODY[agent], roughness: 0.26, metalness: 0.02, envMapIntensity: 1.1 }),
      visor: new THREE.MeshStandardMaterial({ color: '#06080d', roughness: 0.08, metalness: 0.7, envMapIntensity: 1.6 }),
      glow: new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: 3, toneMapped: false }),
      base: new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }),
    };
    return { ...list, dispose: () => Object.values(list).forEach((m) => m.dispose()) };
  }, [agent]);
  const trail = useDisposable(() => new MotionTrail(color), [agent]);
  const state = useMemo(() => ({ pose: { x: 0, z: 0, yaw: 0 }, lastX: 0, lastZ: 0, lean: 0, epoch: Number.NaN, phase: agent * 1.7 }), [agent]);

  useFrame(({ clock }, dt) => {
    const g = root.current;
    const curr = frame.curr;
    if (!g || !curr) return;
    if (state.epoch !== frame.epoch) {
      state.epoch = frame.epoch;
      trail.reset();
    }
    const o = agentAt(arena, agent);
    blendFloorPose(frame.prev, curr, o, frame.alpha, state.pose);
    const { x, z, yaw } = state.pose;
    const step = Math.max(1e-3, Math.min(dt, 0.1));
    const speed = Math.hypot(x - state.lastX, z - state.lastZ) / step;
    if (speed > 12) trail.reset();
    state.lastX = x;
    state.lastZ = z;
    state.lean += (Math.min(speed, 4) * 0.035 - state.lean) * Math.min(1, step * 8);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    const t = clock.elapsedTime;
    if (body.current) {
      body.current.position.y = Math.sin(t * 2.3 + state.phase) * 0.022 * (1 - Math.min(1, speed / 2));
      body.current.rotation.z = -state.lean;
    }
    const flags = curr[o + 3];
    const frozen = hasFlag(flags, FLAG_FROZEN);
    const seen = agent === 0 && hasFlag(flags, FLAG_SEEN);
    const seeing = agent === 1 && hasFlag(flags, FLAG_SEEING);
    const pulse = seen ? 0.5 + 0.5 * Math.sin(t * 14) : 0;
    mats.glow.emissiveIntensity = frozen ? 0.35 : 2.6 + (seeing ? 1.6 : 0) + pulse * 2.4;
    mats.base.opacity = frozen ? 0.12 + 0.08 * Math.sin(t * 3) : 0.42 + pulse * 0.3;
    trail.update(x, z, frozen ? 0 : 1);
  });

  return (
    <group>
      <group ref={root}>
        <group ref={body}>
          <mesh geometry={geometry.body} material={mats.body} castShadow receiveShadow />
          <mesh geometry={geometry.visor} material={mats.visor} />
          <mesh geometry={geometry.line} material={mats.glow} />
          <mesh geometry={geometry.ring} material={mats.glow} />
        </group>
        <mesh geometry={geometry.base} material={mats.base} raycast={() => null} />
      </group>
      <primitive object={trail.mesh} />
    </group>
  );
}
