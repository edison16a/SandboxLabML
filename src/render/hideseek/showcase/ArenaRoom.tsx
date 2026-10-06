'use client';

import * as THREE from 'three';
import { useDisposable } from '@/render/shared/useDisposable';
import { wallsOfLayout } from '../layout/arenaWalls';
import { HS_COLORS } from '../palette';
import { FLOOR_TILE_METERS, sharedFloorMaps } from './proceduralMaps';
import { floorGeometry, skirtingGeometry, stripGeometry, wallGeometry } from './roomGeometry';

/**
 * The showcase room: polished concrete tiles with real normal and
 * roughness detail, rounded plaster walls on a dark skirting and light
 * strips along the top of the outer walls. Four draw calls whatever the
 * layout.
 */
export function ArenaRoom({ layout }: { layout: number }) {
  const walls = useDisposable(() => wallGeometry(wallsOfLayout(layout)), [layout]);
  const skirting = useDisposable(() => skirtingGeometry(wallsOfLayout(layout)), [layout]);
  const skirtingMat = useDisposable(() => new THREE.MeshStandardMaterial({ color: '#2a2e36', roughness: 0.45, metalness: 0.1, envMapIntensity: 0.5 }), []);
  const floor = useDisposable(() => floorGeometry(FLOOR_TILE_METERS), []);
  const strips = useDisposable(() => stripGeometry(), []);
  const floorMat = useDisposable(() => {
    const maps = sharedFloorMaps();
    return new THREE.MeshStandardMaterial({
      color: HS_COLORS.floor,
      map: maps.map,
      normalMap: maps.normalMap,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughnessMap: maps.roughnessMap,
      roughness: 1,
      metalness: 0,
      // Low on purpose: a big softbox mirrored in a semi gloss floor would wash out the key light shadows.
      envMapIntensity: 0.32,
    });
  }, []);
  const wallMat = useDisposable(() => new THREE.MeshStandardMaterial({ color: HS_COLORS.wall, roughness: 0.62, metalness: 0, envMapIntensity: 0.55 }), []);
  const stripMat = useDisposable(() => new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#dfe9ff', emissiveIntensity: 3.2, toneMapped: false }), []);

  return (
    <group>
      <mesh geometry={floor} material={floorMat} receiveShadow />
      <mesh geometry={walls} material={wallMat} castShadow receiveShadow />
      <mesh geometry={skirting} material={skirtingMat} receiveShadow />
      <mesh geometry={strips} material={stripMat} />
    </group>
  );
}
