'use client';

import * as THREE from 'three';
import { useDisposable } from '@/render/shared/useDisposable';
import { wallsOfLayout } from '../layout/arenaWalls';
import { HS_COLORS } from '../palette';
import { floorAoMaterial } from '../room/floorAoMaterial';
import { sharedPlasterMaps } from '../room/plasterMaps';
import { floorAoGeometry, floorGeometry, wallGeometry } from '../room/roomGeometry';
import { FLOOR_TILE_METERS, sharedFloorMaps } from '../room/terrazzoMaps';

/**
 * The showcase room: a polished warm terrazzo floor in 2 m slabs, soft
 * matte plaster walls with round caps, and a baked band of shade along the
 * foot of every wall so the walls sit on the floor even without screen
 * space occlusion. Three draw calls whatever the layout.
 */
export function ArenaRoom({ layout, ao = 0.5 }: { layout: number; /** Strength of the baked floor shade, lower where screen space occlusion runs too. */ ao?: number }) {
  const walls = useDisposable(() => wallGeometry(wallsOfLayout(layout)), [layout]);
  const shade = useDisposable(() => floorAoGeometry(wallsOfLayout(layout)), [layout]);
  const shadeMat = useDisposable(() => floorAoMaterial(ao), [ao]);
  const floor = useDisposable(() => floorGeometry(FLOOR_TILE_METERS), []);
  const floorMat = useDisposable(() => {
    const maps = sharedFloorMaps();
    return new THREE.MeshStandardMaterial({
      color: HS_COLORS.floor,
      map: maps.map,
      normalMap: maps.normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughnessMap: maps.roughnessMap,
      roughness: 1,
      metalness: 0,
      // Honed, so it mirrors a little of the sky. Kept faint, or the floor turns to glare in
      // the first person views, which see it at a grazing angle.
      envMapIntensity: 0.22,
    });
  }, []);
  const wallMat = useDisposable(() => {
    const maps = sharedPlasterMaps();
    return new THREE.MeshStandardMaterial({ color: HS_COLORS.wall, ...maps, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 1, metalness: 0, envMapIntensity: 0.7 });
  }, []);

  return (
    <group>
      <mesh geometry={floor} material={floorMat} receiveShadow />
      <mesh geometry={shade} material={shadeMat} renderOrder={1} raycast={() => null} />
      <mesh geometry={walls} material={wallMat} castShadow receiveShadow />
    </group>
  );
}
