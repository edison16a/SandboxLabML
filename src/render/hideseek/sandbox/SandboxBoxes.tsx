'use client';

import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { boxKindSize, DEFAULT_HIDESEEK_PHYSICS, type BoxKind } from '@/engine/hideseek/physics';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { HS } from '../palette';
import { crateGeometry, edgeFrameGeometry, padlockBodyGeometry, shackleGeometry } from '../showcase/boxGeometry';
import { isLocked, readBox, sandboxFrame } from './sandboxRead';

/** The lock animation: color, glow and shackle all settle in 200 ms. */
const LOCK_SECONDS = 0.2;
const KINDS: BoxKind[] = ['cube', 'plank'];

/** Crate and padlock geometry shared by every box, one crate and edge frame per kind. */
function useBoxGeometry() {
  return useDisposable(() => {
    const sizes = KINDS.map((k) => boxKindSize(DEFAULT_HIDESEEK_PHYSICS, k));
    const crates = sizes.map(crateGeometry);
    const edges = sizes.map((s) => edgeFrameGeometry(s));
    const body = padlockBodyGeometry();
    const shackle = shackleGeometry();
    return { sizes, crates, edges, body, shackle, dispose: () => [...crates, ...edges, body, shackle].forEach((g) => g.dispose()) };
  }, []);
}

type Geometry = ReturnType<typeof useBoxGeometry>;

interface BoxProps {
  index: number;
  kind: BoxKind;
  /** Players in the frame, so the box can find itself after them. */
  players: number;
  geo: Geometry;
  onPointerDown?: (index: number, e: ThreeEvent<PointerEvent>) => void;
  onDoubleClick?: (index: number) => void;
}

/**
 * One crate, like the showcase crates: locking it turns it amber over
 * 200 ms, lights its edges and snaps a padlock shut on top.
 */
function SandboxBox({ index, kind, players, geo, onPointerDown, onDoubleClick }: BoxProps) {
  const { frame } = useHsScene();
  const k = kind === 'cube' ? 0 : 1;
  const root = useRef<THREE.Group>(null);
  const edge = useRef<THREE.Mesh>(null);
  const lock = useRef<THREE.Group>(null);
  const shackle = useRef<THREE.Mesh>(null);
  const base = kind === 'cube' ? HS.cube : HS.plank;
  const mats = useDisposable(() => {
    const list = {
      crate: new THREE.MeshStandardMaterial({ color: base, roughness: 0.55, metalness: 0, envMapIntensity: 0.6 }),
      edge: new THREE.MeshStandardMaterial({ color: '#000000', emissive: HS.locked, emissiveIntensity: 0, toneMapped: false, transparent: true, opacity: 0 }),
      body: new THREE.MeshStandardMaterial({ color: '#e9a03b', roughness: 0.32, metalness: 0.85, emissive: HS.locked, emissiveIntensity: 0.25 }),
      steel: new THREE.MeshStandardMaterial({ color: '#d9dee6', roughness: 0.22, metalness: 1 }),
    };
    return { ...list, dispose: () => Object.values(list).forEach((m) => m.dispose()) };
  }, [base]);
  const state = useMemo(() => ({ lock: 0, pose: { x: 0, z: 0, yaw: 0 } }), []);

  useFrame((three, dt) => {
    const g = root.current;
    const curr = sandboxFrame(frame);
    if (!g || !curr) return;
    const bits = readBox(frame, curr, players, index, state.pose);
    g.position.set(state.pose.x, 0, state.pose.z);
    g.rotation.y = state.pose.yaw;
    const target = isLocked(bits) ? 1 : 0;
    const step = Math.min(dt, 0.05) / LOCK_SECONDS;
    const v = (state.lock = THREE.MathUtils.clamp(state.lock + (target ? step : -step), 0, 1));
    const e = v * v * (3 - 2 * v);
    mats.crate.color.copy(base).lerp(HS.locked, e * 0.85);
    mats.crate.emissive.copy(HS.locked).multiplyScalar(e * 0.08);
    mats.edge.emissiveIntensity = e * 2.6;
    mats.edge.opacity = e;
    if (edge.current) edge.current.visible = v > 0.001;
    if (lock.current) {
      lock.current.visible = v > 0.001;
      lock.current.scale.setScalar(0.6 + 0.4 * Math.min(1, v * 1.5));
    }
    if (shackle.current) {
      shackle.current.position.y = (1 - e) * 0.09;
      shackle.current.rotation.y = (1 - e) * (Math.PI / 2);
    }
    // While paused the canvas draws on demand, so keep asking until the lock has played out.
    if (v !== target) three.invalidate();
  });

  return (
    <group ref={root}>
      <mesh
        geometry={geo.crates[k]}
        material={mats.crate}
        castShadow
        receiveShadow
        onPointerDown={onPointerDown ? (e) => onPointerDown(index, e) : undefined}
        onDoubleClick={
          onDoubleClick
            ? (e) => {
                e.stopPropagation();
                onDoubleClick(index);
              }
            : undefined
        }
      />
      <mesh ref={edge} geometry={geo.edges[k]} material={mats.edge} visible={false} raycast={() => null} />
      <group ref={lock} position={[0, geo.sizes[k].height + 0.002, 0]} visible={false}>
        <mesh geometry={geo.body} material={mats.body} castShadow raycast={() => null} />
        <mesh ref={shackle} geometry={geo.shackle} material={mats.steel} castShadow raycast={() => null} />
      </group>
    </group>
  );
}

/** Every box of the Sandbox match, in frame order. */
export function SandboxBoxes({ kinds, players, onPointerDown, onDoubleClick }: { kinds: BoxKind[]; players: number } & Pick<BoxProps, 'onPointerDown' | 'onDoubleClick'>) {
  const geo = useBoxGeometry();
  return (
    <group>
      {kinds.map((kind, i) => (
        <SandboxBox key={`${i}:${kind}`} index={i} kind={kind} players={players} geo={geo} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} />
      ))}
    </group>
  );
}
