'use client';

import type * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import { useDisposable } from '@/render/shared/useDisposable';
import { RIG } from './characterGeometry';
import { characterKit } from './characterKit';
import { CharacterMaterials } from './characterMaterials';
import { CharacterMotion } from './characterMotion';
import { FACES, type FaceKey } from './characterFace';
import { createCharacterDrive, type CharacterDetail, type CharacterDrive, type CharacterTeam } from './types';

export interface HsCharacterProps {
  team: CharacterTeam;
  /**
   * Called once a frame, before the character poses, to fill in where it is
   * and what it is doing. Return false to hide it this frame.
   */
  read: (drive: CharacterDrive) => boolean | void;
  detail?: CharacterDetail;
  /** Cast and receive shadow maps, on tiers that have them. */
  shadows?: boolean;
  /** A soft round shadow under it, for tiers without shadow maps. */
  blob?: boolean;
  /** Staggers idle motion, so a crowd does not breathe in step. */
  seed?: number;
  /** Rides along with the character at its feet, e.g. a name tag. Not turned with it. */
  children?: ReactNode;
}

/** Carrying pulls the arms in, a startle throws them wide. */
const REST_SPLAY = RIG.restSplay;
const REACH_SPLAY = 0.12;
const RAISE_SPLAY = 1.75;
const REACH_SWING = 1.42;

interface Parts {
  root: THREE.Group | null;
  feet: THREE.Group | null;
  body: THREE.Group | null;
  head: THREE.Group | null;
  shoulders: Array<THREE.Group | null>;
  arms: Array<THREE.Group | null>;
  faces: Partial<Record<FaceKey, THREE.Mesh | null>>;
  blob: THREE.Mesh | null;
}

/**
 * A cute rounded hide and seek character: a big round head with a simple
 * glowing face, a soft bean body with little arms, glossy and lit from
 * within in its team color. It animates itself from what `read` reports:
 * it bobs when idle, leans and waddles when it moves, swings its arms,
 * reaches forward to carry, hops when spotted and sleeps when frozen.
 */
export function HsCharacter({ team, read, detail = 'full', shadows = false, blob = true, seed = 0, children }: HsCharacterProps) {
  const kit = characterKit(detail);
  const mats = useDisposable(() => new CharacterMaterials(team, detail, kit.blobMap), [team, detail, kit]);
  const state = useMemo(() => ({ drive: createCharacterDrive(), motion: new CharacterMotion(seed), face: 'happy' as FaceKey }), [seed]);
  const parts = useRef<Parts>({ root: null, feet: null, body: null, head: null, shoulders: [null, null], arms: [null, null], faces: {}, blob: null });

  useFrame(({ clock }, dt) => {
    const p = parts.current;
    if (!p.root || !p.feet || !p.body || !p.head) return;
    const visible = read(state.drive) !== false;
    p.root.visible = p.feet.visible = visible;
    if (!visible) return;
    const d = state.drive;
    const pose = state.motion.update(d, dt, clock.elapsedTime);
    p.root.position.set(d.x, 0, d.z);
    p.root.rotation.y = d.yaw;
    p.feet.position.set(d.x, 0, d.z);
    p.body.position.y = pose.bob;
    p.body.rotation.set(pose.roll, 0, -pose.lean);
    const s = pose.squash;
    p.body.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    p.head.rotation.set(0, pose.headYaw, -pose.headPitch);
    const splay = REST_SPLAY + (REACH_SPLAY - REST_SPLAY) * pose.reach + (RAISE_SPLAY - REST_SPLAY) * pose.raise;
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? 1 : -1;
      const shoulder = p.shoulders[side];
      const arm = p.arms[side];
      if (shoulder) shoulder.rotation.x = sign * splay;
      if (arm) arm.rotation.z = sign * pose.swing + pose.reach * REACH_SWING + pose.raise * 0.35;
    }
    const face: FaceKey = pose.expression === 'keen' && pose.blink < 0.5 ? 'blink' : pose.expression;
    if (face !== state.face) {
      const was = p.faces[state.face];
      const now = p.faces[face];
      if (was) was.visible = false;
      if (now) now.visible = true;
      state.face = face;
    }
    if (p.blob) {
      p.blob.visible = blob;
      p.blob.scale.setScalar(1 - Math.min(0.4, pose.bob * 2));
    }
    mats.apply(pose);
  });

  const arm = (side: 0 | 1) => (
    <group ref={(el) => void (parts.current.shoulders[side] = el)} position={[0, RIG.shoulderY, side === 0 ? -RIG.shoulderZ : RIG.shoulderZ]}>
      <group ref={(el) => void (parts.current.arms[side] = el)}>
        <mesh geometry={kit.arm} material={mats.body} castShadow={shadows} receiveShadow={shadows} />
      </group>
    </group>
  );

  return (
    <>
      <group ref={(el) => void (parts.current.root = el)}>
        <group ref={(el) => void (parts.current.body = el)}>
          <mesh geometry={kit.body} material={mats.body} castShadow={shadows} receiveShadow={shadows} />
          <group ref={(el) => void (parts.current.head = el)} position={[0, RIG.headY, 0]}>
            <mesh geometry={kit.head} material={mats.body} scale={RIG.headScale} castShadow={shadows} receiveShadow={shadows}>
              {FACES.map((f) => (
                <mesh key={f} ref={(el) => void (parts.current.faces[f] = el)} geometry={kit.faces[f]} material={mats.face} visible={f === 'happy'} raycast={() => null} />
              ))}
            </mesh>
          </group>
          {arm(0)}
          {arm(1)}
        </group>
        <mesh ref={(el) => void (parts.current.blob = el)} geometry={kit.blob} material={mats.blob} renderOrder={1} raycast={() => null} />
      </group>
      <group ref={(el) => void (parts.current.feet = el)}>{children}</group>
    </>
  );
}
