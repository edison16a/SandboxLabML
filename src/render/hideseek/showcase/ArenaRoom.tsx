'use client';

import { useMemo } from 'react';
import type { Rect } from '@/engine/hideseek/layouts/types';
import { useDisposable } from '@/render/shared/useDisposable';
import { wallsOfLayout } from '../layout/arenaWalls';
import { HS_COLORS } from '../palette';
import { floorAoMaterial } from '../room/floorAoMaterial';
import { groundedMaterial } from '../room/groundedMaterial';
import { floorAoGeometry, floorGeometry, wallGeometry } from '../room/roomGeometry';
import { tileFloorMaterial } from '../room/tileFloor';

interface RoomProps {
  walls: Rect[];
  /** Changes when the walls do. The array itself may be new every render. */
  wallsKey: string | number;
  /** Strength of the baked floor shade, lower where screen space occlusion runs too. */
  ao?: number;
}

/**
 * A room built from any list of walls: a floor of light grey tiles with
 * crisp grout and a satin sheen, clean light grey slab walls, and a baked
 * band of shade along the foot of every wall so the walls sit on the floor
 * even without screen space occlusion. Three draw calls whatever the
 * walls. The showcase arenas and the Sandbox rooms both use it, so a room
 * the user drew looks like a built in one.
 */
export function RoomMesh({ walls, wallsKey, ao = 0.5 }: RoomProps) {
  // Rebuilt only when wallsKey changes; the walls array can be new on every render.
  const wallGeo = useDisposable(() => wallGeometry(walls), [wallsKey]);
  const shade = useDisposable(() => floorAoGeometry(walls), [wallsKey]);
  const shadeMat = useDisposable(() => floorAoMaterial(ao), [ao]);
  const floor = useDisposable(() => floorGeometry(), []);
  const floorMat = useDisposable(() => tileFloorMaterial(), []);
  const wallMat = useDisposable(() => groundedMaterial({ color: HS_COLORS.wall, roughness: 0.58, metalness: 0, envMapIntensity: 0.65 }, 0.8, 0.8), []);

  return (
    <group>
      <mesh geometry={floor} material={floorMat} receiveShadow />
      <mesh geometry={shade} material={shadeMat} renderOrder={1} raycast={() => null} />
      <mesh geometry={wallGeo} material={wallMat} castShadow receiveShadow />
    </group>
  );
}

/** The showcase room for one of the training layouts. */
export function ArenaRoom({ layout, ao }: { layout: number; ao?: number }) {
  const walls = useMemo(() => wallsOfLayout(layout), [layout]);
  return <RoomMesh walls={walls} wallsKey={layout} ao={ao} />;
}
