'use client';

import * as THREE from 'three';
import type { Rect } from '@/engine/hideseek/layouts/types';
import { useDisposable } from '@/render/shared/useDisposable';
import { HS_COLORS } from '../palette';
import { sharedPlasterMaps } from '../showcase/plasterMaps';
import { FLOOR_TILE_METERS, sharedFloorMaps } from '../showcase/proceduralMaps';
import { floorGeometry, skirtingGeometry, stripGeometry, wallGeometry } from '../showcase/roomGeometry';

/**
 * The Sandbox room, built from any list of walls: the same concrete floor,
 * rounded plaster walls, skirting and light strips as the showcase room,
 * so a room the user drew looks like a built-in one. The wall geometry is
 * rebuilt only when `wallsKey` says the walls changed.
 */
export function SandboxRoomMesh({ walls, wallsKey }: { walls: Rect[]; wallsKey: string }) {
  // The walls array is new whenever the room is; wallsKey says when its contents changed.
  const wallGeo = useDisposable(() => wallGeometry(walls), [wallsKey]);
  const skirting = useDisposable(() => skirtingGeometry(walls), [wallsKey]);
  const floor = useDisposable(() => floorGeometry(FLOOR_TILE_METERS), []);
  const strips = useDisposable(() => stripGeometry(), []);
  const mats = useDisposable(() => {
    const floorMaps = sharedFloorMaps();
    const plaster = sharedPlasterMaps();
    const list = {
      floor: new THREE.MeshStandardMaterial({
        color: HS_COLORS.floor,
        map: floorMaps.map,
        normalMap: floorMaps.normalMap,
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughnessMap: floorMaps.roughnessMap,
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0.32,
      }),
      wall: new THREE.MeshStandardMaterial({ color: HS_COLORS.wall, ...plaster, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, metalness: 0, envMapIntensity: 0.55 }),
      skirting: new THREE.MeshStandardMaterial({ color: '#2a2e36', roughness: 0.45, metalness: 0.1, envMapIntensity: 0.5 }),
      strip: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#dfe9ff', emissiveIntensity: 3.2, toneMapped: false }),
    };
    return { ...list, dispose: () => Object.values(list).forEach((m) => m.dispose()) };
  }, []);

  return (
    <group>
      <mesh geometry={floor} material={mats.floor} receiveShadow />
      <mesh geometry={wallGeo} material={mats.wall} castShadow receiveShadow />
      <mesh geometry={skirting} material={mats.skirting} receiveShadow />
      <mesh geometry={strips} material={mats.strip} />
    </group>
  );
}
