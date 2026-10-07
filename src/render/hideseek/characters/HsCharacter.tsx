'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import { useDisposable } from '@/render/shared/useDisposable';
import { characterKit } from './characterKit';
import { CharacterMaterials } from './characterMaterials';
import { CharacterMotion } from './motion/characterMotion';
import { createSkeleton } from './rig/bones';
import { CharacterPoser } from './rig/poser';
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
  /** Staggers idle motion, so a crowd does not breathe or blink in step. */
  seed?: number;
  /** Rides along with the character at its feet, e.g. a name tag. Not turned with it. */
  children?: ReactNode;
}

/** How fast the blob shadow shrinks with height: to half its size 2.2 m up, about a vault's peak. */
const BLOB_SHRINK = 0.45;

/**
 * A rounded hide and seek character with a big head, big eyes and short
 * legs, glossy in its team color and lit from within at the rim. It is
 * one skinned mesh for the body and one for the face, posed every frame by
 * CharacterMotion from what `read` reports: feet planted on the floor,
 * knees and elbows bent by IK, a trunk that leans and banks with its real
 * momentum, eyes and head turned to what it sees, and a mood on its face.
 * Seekers stand in a glowing ring.
 */
export function HsCharacter({ team, read, detail = 'full', shadows = false, blob = true, seed = 0, children }: HsCharacterProps) {
  const kit = characterKit(detail);
  const mats = useDisposable(() => new CharacterMaterials(team, detail, kit.blobMap), [team, detail, kit]);
  const rig = useDisposable(() => {
    const { root, bones, skeleton } = createSkeleton();
    const body = new THREE.SkinnedMesh(kit.body, mats.body);
    const face = new THREE.SkinnedMesh(kit.face, mats.face);
    for (const m of [body, face]) {
      m.bind(skeleton);
      // The bind pose has every part at the origin, so the computed bounds would be wrong; the character is always drawn.
      m.frustumCulled = false;
      m.receiveShadow = shadows;
    }
    body.castShadow = shadows;
    return { root, body, face, poser: new CharacterPoser(bones), dispose: () => skeleton.dispose() };
  }, [kit, mats, shadows]);
  const state = useMemo(() => ({ drive: createCharacterDrive(), motion: new CharacterMotion(seed) }), [seed]);
  const group = useRef<THREE.Group>(null);
  const feet = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g || !feet.current) return;
    const visible = read(state.drive) !== false;
    g.visible = feet.current.visible = visible;
    if (!visible) return;
    const d = state.drive;
    const pose = state.motion.update(d, dt, clock.elapsedTime);
    g.position.set(d.x, d.elevation, d.z);
    g.rotation.y = d.yaw;
    feet.current.position.set(d.x, d.elevation, d.z);
    rig.poser.apply(pose);
    mats.apply(pose, d.elevation, clock.elapsedTime);
    if (shadow.current) {
      // The shadow stays on the floor, shrinking as the body rises off it.
      shadow.current.visible = blob;
      shadow.current.position.y = -d.elevation;
      shadow.current.scale.setScalar(1 / (1 + d.elevation * BLOB_SHRINK));
    }
    if (ring.current) ring.current.visible = !d.airborne;
  });

  return (
    <>
      <group ref={group}>
        <primitive object={rig.root} />
        <primitive object={rig.body} />
        <primitive object={rig.face} />
        <mesh ref={shadow} geometry={kit.blob} material={mats.blob} renderOrder={1} raycast={() => null} />
        {team === 'seeker' && <mesh ref={ring} geometry={kit.ring} material={mats.ring} renderOrder={2} raycast={() => null} />}
      </group>
      <group ref={feet}>{children}</group>
    </>
  );
}
