'use client';

import type { City } from '@/engine/driving/city/types';
import { useDisposable } from '@/render/shared/useDisposable';
import type { DrivingTier } from '../../quality';
import { createGroundMaterials } from './groundMaterials';
import { markingGeometry, wearGeometry } from './markings';
import { asphaltGeometry, slabGeometry } from './slabs';

/**
 * The street surface of the whole city: asphalt, tire wear, paint, curbs
 * and sidewalks. A handful of draw calls for every street, built once per
 * city and tier.
 */
export function CityGround({ city, tier, shadows }: { city: City; tier: DrivingTier; shadows: boolean }) {
  const geo = useDisposable(() => {
    const slabs = slabGeometry(city);
    const parts = { asphalt: asphaltGeometry(city), marks: markingGeometry(city), wear: wearGeometry(city), ...slabs };
    return { ...parts, dispose: () => Object.values(parts).forEach((g) => g.dispose()) };
  }, [city]);
  const mat = useDisposable(() => createGroundMaterials(tier), [tier]);
  return (
    <group>
      <mesh geometry={geo.asphalt} material={mat.asphalt} receiveShadow={shadows} />
      <mesh geometry={geo.wear} material={mat.wear} renderOrder={-2} />
      <mesh geometry={geo.marks} material={mat.paint} receiveShadow={shadows} />
      <mesh geometry={geo.curbs} material={mat.curb} receiveShadow={shadows} castShadow={false} />
      <mesh geometry={geo.walks} material={mat.walk} receiveShadow={shadows} />
    </group>
  );
}
