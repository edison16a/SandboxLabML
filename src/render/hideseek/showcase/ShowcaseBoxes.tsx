'use client';

import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BOX_COUNT, boxSize, DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { blendFloorPose, boxAt } from '../frame/snapshotRead';
import { HS } from '../palette';
import { crateGeometry, edgeFrameGeometry, padlockBodyGeometry, shackleGeometry } from './boxGeometry';

const SIZES = Array.from({ length: BOX_COUNT }, (_, i) => boxSize(DEFAULT_HIDESEEK_PHYSICS, i));
/** The lock animation: color, glow and shackle all settle in 200 ms. */
const LOCK_SECONDS = 0.2;

interface BoxParts {
  root: THREE.Group | null;
  edge: THREE.Mesh | null;
  lock: THREE.Group | null;
  shackle: THREE.Mesh | null;
}

/** Called when a crate is pressed, for Sandbox dragging. */
export type BoxPointerHandler = (index: number, e: ThreeEvent<PointerEvent>) => void;

/**
 * The four crates of the showcase arena. Locking one turns it amber over
 * 200 ms, lights its edges and snaps a padlock shut on top, so a fort being
 * sealed is visible from across the room.
 */
export function ShowcaseBoxes({ arena, onBoxPointerDown }: { arena: number; onBoxPointerDown?: BoxPointerHandler }) {
  const { frame } = useHsScene();
  const parts = useRef<BoxParts[]>(Array.from({ length: BOX_COUNT }, () => ({ root: null, edge: null, lock: null, shackle: null })));
  const geo = useDisposable(() => {
    const crates = SIZES.map(crateGeometry);
    const edges = SIZES.map((s) => edgeFrameGeometry(s));
    const body = padlockBodyGeometry();
    const shackle = shackleGeometry();
    return { crates, edges, body, shackle, dispose: () => [...crates, ...edges, body, shackle].forEach((g) => g.dispose()) };
  }, []);
  const mats = useDisposable(() => {
    const crate = SIZES.map((_, i) => new THREE.MeshStandardMaterial({ color: i < 2 ? HS.cube : HS.plank, roughness: 0.5, metalness: 0, envMapIntensity: 1 }));
    const edge = SIZES.map(() => new THREE.MeshStandardMaterial({ color: '#000000', emissive: HS.locked, emissiveIntensity: 0, toneMapped: false, transparent: true, opacity: 0 }));
    const body = new THREE.MeshStandardMaterial({ color: '#e9a03b', roughness: 0.32, metalness: 0.85, emissive: HS.locked, emissiveIntensity: 0.25 });
    const steel = new THREE.MeshStandardMaterial({ color: '#d9dee6', roughness: 0.22, metalness: 1 });
    return { crate, edge, body, steel, dispose: () => [...crate, ...edge, body, steel].forEach((m) => m.dispose()) };
  }, []);
  const state = useMemo(() => ({ lock: new Float32Array(BOX_COUNT), pose: { x: 0, z: 0, yaw: 0 }, c: new THREE.Color() }), []);

  useFrame((_, dt) => {
    const curr = frame.curr;
    if (!curr) return;
    const step = Math.min(dt, 0.05) / LOCK_SECONDS;
    for (let b = 0; b < BOX_COUNT; b++) {
      const p = parts.current[b];
      if (!p.root) continue;
      const o = boxAt(arena, b);
      blendFloorPose(frame.prev, curr, o, frame.alpha, state.pose);
      p.root.position.set(state.pose.x, 0, state.pose.z);
      p.root.rotation.y = state.pose.yaw;
      const target = curr[o + 3] === 1 ? 1 : 0;
      const k = (state.lock[b] = THREE.MathUtils.clamp(state.lock[b] + (target ? step : -step), 0, 1));
      const e = k * k * (3 - 2 * k);
      mats.crate[b].color.copy(b < 2 ? HS.cube : HS.plank).lerp(HS.locked, e * 0.85);
      mats.crate[b].emissive.copy(HS.locked).multiplyScalar(e * 0.08);
      mats.edge[b].emissiveIntensity = e * 2.6;
      mats.edge[b].opacity = e;
      if (p.edge) p.edge.visible = k > 0.001;
      if (p.lock) {
        p.lock.visible = k > 0.001;
        p.lock.scale.setScalar(0.6 + 0.4 * Math.min(1, k * 1.5));
      }
      if (p.shackle) {
        // Open: raised and swung a quarter turn. Closed: seated straight.
        p.shackle.position.y = (1 - e) * 0.09;
        p.shackle.rotation.y = (1 - e) * (Math.PI / 2);
      }
    }
  });

  return (
    <group>
      {SIZES.map((size, b) => (
        <group key={b} ref={(el) => void (parts.current[b].root = el)}>
          <mesh
            geometry={geo.crates[b]}
            material={mats.crate[b]}
            castShadow
            receiveShadow
            onPointerDown={onBoxPointerDown ? (e) => onBoxPointerDown(b, e) : undefined}
          />
          <mesh ref={(el) => void (parts.current[b].edge = el)} geometry={geo.edges[b]} material={mats.edge[b]} visible={false} raycast={() => null} />
          <group ref={(el) => void (parts.current[b].lock = el)} position={[0, size.height + 0.002, 0]} visible={false}>
            <mesh geometry={geo.body} material={mats.body} castShadow raycast={() => null} />
            <mesh ref={(el) => void (parts.current[b].shackle = el)} geometry={geo.shackle} material={mats.steel} castShadow raycast={() => null} />
          </group>
        </group>
      ))}
    </group>
  );
}
