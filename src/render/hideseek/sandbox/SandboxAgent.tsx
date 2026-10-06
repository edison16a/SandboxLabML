'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { FLAG_FROZEN, FLAG_SEEING, FLAG_SEEN } from '@/engine/hideseek/snapshot';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { hasFlag } from '../frame/snapshotRead';
import { teamColor } from '../palette';
import { MotionTrail } from '../showcase/MotionTrail';
import type { useAgentGeometry } from '../showcase/ShowcaseAgent';
import { readPlayer, sandboxFrame, seekerIdle } from './sandboxRead';

/** Body tints in a softened team color, the same as the showcase agents. */
const BODY = ['#8fbcff', '#ff9aa4'];

interface Props {
  /** Slot in the Sandbox frame. */
  slot: number;
  /** 0 hider, 1 seeker. */
  team: 0 | 1;
  geometry: ReturnType<typeof useAgentGeometry>;
}

/**
 * One Sandbox player, drawn like a showcase agent: glossy capsule, dark
 * visor showing its facing, team colored light accents, an idle bob, a lean
 * into its movement and a fading floor trail. A frozen seeker (prep) dims;
 * a seen hider pulses. Reads its pose from the Sandbox frame by slot.
 */
export function SandboxAgent({ slot, team, geometry }: Props) {
  const { frame } = useHsScene();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const color = teamColor(team);
  // These materials and BODY match ShowcaseAgent's line for line, so a player looks like the showcase agent.
  // ShowcaseAgent is frozen until the Hide and Seek visual upgrade merges. That merge must move both onto one
  // shared agentMaterials(team) factory, or the Sandbox keeps the old look.
  const mats = useDisposable(() => {
    const list = {
      body: new THREE.MeshStandardMaterial({ color: BODY[team], roughness: 0.26, metalness: 0.02, envMapIntensity: 1.1 }),
      visor: new THREE.MeshStandardMaterial({ color: '#06080d', roughness: 0.08, metalness: 0.7, envMapIntensity: 1.6 }),
      glow: new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: 3, toneMapped: false }),
      base: new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }),
    };
    return { ...list, dispose: () => Object.values(list).forEach((m) => m.dispose()) };
  }, [team]);
  const trail = useDisposable(() => new MotionTrail(color), [team]);
  const state = useMemo(() => ({ pose: { x: 0, z: 0, yaw: 0 }, lastX: 0, lastZ: 0, lean: 0, epoch: Number.NaN, phase: slot * 1.37 }), [slot]);

  useFrame(({ clock }, dt) => {
    const g = root.current;
    const curr = sandboxFrame(frame);
    if (!g) return;
    g.visible = curr !== null;
    if (!curr) return;
    if (state.epoch !== frame.epoch) {
      state.epoch = frame.epoch;
      trail.reset();
    }
    const flags = readPlayer(frame, curr, slot, state.pose);
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
    const frozen = team === 1 ? seekerIdle(curr, flags) : hasFlag(flags, FLAG_FROZEN);
    const seen = team === 0 && hasFlag(flags, FLAG_SEEN);
    const seeing = team === 1 && hasFlag(flags, FLAG_SEEING);
    const pulse = seen ? 0.5 + 0.5 * Math.sin(t * 14) : 0;
    mats.glow.emissiveIntensity = frozen ? 0.35 : 2.6 + (seeing ? 1.6 : 0) + pulse * 2.4;
    mats.base.opacity = frozen ? 0.12 + 0.08 * Math.sin(t * 3) : 0.42 + pulse * 0.3;
    trail.update(x, z, frozen ? 0 : 1);
  });

  return (
    <group>
      <group ref={root} visible={false}>
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
