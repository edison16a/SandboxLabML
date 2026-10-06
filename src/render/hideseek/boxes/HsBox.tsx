'use client';

import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { BoxKind, BoxSize } from '@/engine/hideseek/physics';
import { LOCK_FREE, LOCK_SEEKERS } from '@/engine/hideseek/snapshot';
import { useDisposable } from '@/render/shared/useDisposable';
import { crateExtras, crateParts } from './boxKit';
import { BoxMaterials } from './boxMaterials';

/** Where a crate is and its lock, filled in by the caller every frame. */
export interface BoxDrive {
  x: number;
  z: number;
  yaw: number;
  /** LOCK_FREE, LOCK_HIDERS or LOCK_SEEKERS (see the engine snapshot). */
  lock: number;
}

export interface HsBoxProps {
  kind: BoxKind;
  size: BoxSize;
  /** Fills in the crate's state once a frame. Return false to hide it. */
  read: (drive: BoxDrive) => boolean | void;
  /** Physical panels with a clear coat; off for the cheapest tier. */
  full?: boolean;
  /** Cast and receive shadow maps. */
  shadows?: boolean;
  /** A soft shadow under it, for tiers without shadow maps. */
  blob?: boolean;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onDoubleClick?: (e: ThreeEvent<MouseEvent>) => void;
}

/** The lock animation: braces, hologram and shackle all settle in 200 ms. */
const LOCK_SECONDS = 0.2;
/** Height of the padlock hologram over the crate top, m. */
const HOVER = 0.55;
/** The padlock is drawn larger than life so it reads from the default camera, 25 m away. */
const HOLO_SCALE = 1.35;

/**
 * One braced crate. Locking it turns the braces to the owner team's color and
 * raises a padlock hologram that bobs and turns slowly over the top, its
 * shackle snapping shut, so a sealed fort reads from across the room.
 */
export function HsBox({ kind, size, read, full = true, shadows = false, blob = false, onPointerDown, onDoubleClick }: HsBoxProps) {
  const parts = crateParts(size);
  const extras = crateExtras();
  const mats = useDisposable(() => new BoxMaterials(kind, full, extras.blobMap), [kind, full, extras]);
  const state = useMemo(() => ({ drive: { x: 0, z: 0, yaw: 0, lock: LOCK_FREE } as BoxDrive, lock: 0, owner: 0, seed: Math.random() * 10 }), []);
  const root = useRef<THREE.Group>(null);
  const holo = useRef<THREE.Group>(null);
  const shackle = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);

  useFrame((three, dt) => {
    const g = root.current;
    if (!g) return;
    const visible = read(state.drive) !== false;
    g.visible = visible;
    if (!visible) return;
    const d = state.drive;
    g.position.set(d.x, 0, d.z);
    g.rotation.y = d.yaw;
    const target = d.lock === LOCK_FREE ? 0 : 1;
    // The owner sticks while a lock fades out, so an unlock never flashes the other team's color.
    if (target) state.owner = d.lock === LOCK_SEEKERS ? 1 : 0;
    const step = Math.min(dt, 0.05) / LOCK_SECONDS;
    state.lock = THREE.MathUtils.clamp(state.lock + (target ? step : -step), 0, 1);
    const k = state.lock;
    const e = k * k * (3 - 2 * k);
    const t = three.clock.elapsedTime;
    mats.apply(e, t, state.owner);
    const h = holo.current;
    if (h) {
      h.visible = k > 0.001;
      // A little overshoot as it appears, then a slow bob and turn.
      const pop = 0.55 + 0.45 * e + 0.18 * Math.sin(e * Math.PI) * (1 - e);
      h.scale.setScalar(pop * HOLO_SCALE);
      h.position.y = size.height + HOVER + Math.sin(t * 1.9 + state.seed) * 0.035;
      h.rotation.y = t * 0.7 + state.seed - d.yaw;
    }
    if (shackle.current) {
      // Open: raised and swung a quarter turn. Closed: seated straight.
      shackle.current.position.y = (1 - e) * 0.1;
      shackle.current.rotation.y = (1 - e) * (Math.PI / 2);
    }
    if (shadow.current) shadow.current.visible = blob;
    // While paused the canvas only draws on demand, so ask for the next
    // frame until a lock or unlock has fully played out.
    if (k !== target) three.invalidate();
  });

  return (
    <group ref={root}>
      <mesh geometry={parts.panels} material={mats.panel} castShadow={shadows} receiveShadow={shadows} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} />
      <mesh geometry={parts.braces} material={mats.brace} castShadow={shadows} receiveShadow={shadows} raycast={() => null} />
      <group ref={holo} visible={false}>
        <mesh geometry={extras.lockBody} material={mats.lockBody} renderOrder={4} raycast={() => null} />
        <mesh ref={shackle} geometry={extras.lockShackle} material={mats.lockShackle} renderOrder={4} raycast={() => null} />
      </group>
      <mesh ref={shadow} geometry={extras.blob} material={mats.blob} position={[0, 0.005, 0]} scale={[size.length + 0.7, 1, size.width + 0.7]} renderOrder={1} visible={blob} raycast={() => null} />
    </group>
  );
}
