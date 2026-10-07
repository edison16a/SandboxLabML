'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useDisposable } from '@/render/shared/useDisposable';
import { withHaze } from '../world/atmosphere';
import type { WorldData } from '../world/worldData';
import { brandTexture, type BoardStyle } from './brandTexture';
import { billboardSpots, flagSpots, towerSpots, type Spot } from './dressingSpots';
import { BOARD, boardFrameGeometry, poleGeometry, towerGeometry } from './dressingGeometry';
import { createFlagMaterial, FLAG_COLORS, FLAG_YAW, flagGeometry } from './flags';

const STYLES: BoardStyle[] = ['dark', 'light', 'blue'];

/** Fills an instanced mesh from spots once: each at its spot, turned by its yaw plus `turn`. */
function Placed({ spots, geometry, material, lift = 0, turn, colors, castShadow = true }: { spots: Spot[]; geometry: THREE.BufferGeometry; material: THREE.Material; lift?: number; turn: (s: Spot) => number; colors?: (s: Spot) => string; castShadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    spots.forEach((s, i) => {
      m.setMatrixAt(i, mat.compose(new THREE.Vector3(s.x, s.y + lift, s.z), q.setFromAxisAngle(up, turn(s)), new THREE.Vector3(1, 1, 1)));
      if (colors) m.setColorAt(i, c.set(colors(s)));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [spots, lift, turn, colors]);
  if (!spots.length) return null;
  return <instancedMesh key={spots.length} ref={ref} args={[geometry, material, spots.length]} castShadow={castShadow} receiveShadow />;
}

const faceRoad = (s: Spot) => s.yaw + (s.side > 0 ? 0 : Math.PI);
const downwind = () => FLAG_YAW;
const flagColor = (s: Spot) => FLAG_COLORS[s.kind % FLAG_COLORS.length];

/**
 * Circuit furniture: floodlight towers at the stadium corners, flags on
 * every roof streaming downwind, and trackside boards along the straights
 * carrying the lab's own mark.
 */
export function Dressing({ world }: { world: WorldData }) {
  const spots = useMemo(
    () => ({ boards: billboardSpots(world.track, world.field, world.layout), towers: towerSpots(world.layout), flags: flagSpots(world.layout) }),
    [world],
  );
  const byStyle = useMemo(() => STYLES.map((_, k) => spots.boards.filter((b) => b.kind === k)), [spots]);
  const kit = useDisposable(() => {
    const geo = { tower: towerGeometry(), pole: poleGeometry(), flag: flagGeometry(), frame: boardFrameGeometry(), face: new THREE.PlaneGeometry(BOARD.w, BOARD.h).rotateY(Math.PI).translate(0, BOARD.lift + BOARD.h / 2, 0) };
    const faces = STYLES.map((s) => brandTexture(s, BOARD.w / BOARD.h));
    const steel = withHaze(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4, envMapIntensity: 0.9 }));
    const pole = withHaze(new THREE.MeshStandardMaterial({ color: '#d9dcdf', roughness: 0.35, metalness: 0.6 }));
    const print = faces.map((map) => withHaze(new THREE.MeshStandardMaterial({ map, roughness: 0.55 })));
    const flag = createFlagMaterial();
    const all = [...Object.values(geo), ...faces, steel, pole, ...print, flag.material];
    return { geo, steel, pole, print, flag, dispose: () => all.forEach((x) => x.dispose()) };
  }, []);
  useFrame((_, dt) => void (kit.flag.time.value += Math.min(dt, 0.1)));

  return (
    <group>
      <Placed spots={spots.towers} geometry={kit.geo.tower} material={kit.steel} turn={faceRoad} />
      <Placed spots={spots.flags} geometry={kit.geo.pole} material={kit.pole} turn={downwind} castShadow={false} />
      <Placed spots={spots.flags} geometry={kit.geo.flag} material={kit.flag.material} lift={3.15} turn={downwind} colors={flagColor} castShadow={false} />
      <Placed spots={spots.boards} geometry={kit.geo.frame} material={kit.steel} turn={faceRoad} />
      {byStyle.map((list, k) => (
        <Placed key={k} spots={list} geometry={kit.geo.face} material={kit.print[k]} turn={faceRoad} castShadow={false} />
      ))}
    </group>
  );
}
