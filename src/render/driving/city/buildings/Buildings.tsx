'use client';

import * as THREE from 'three';
import type { City } from '@/engine/driving/city/types';
import { useDisposable } from '@/render/shared/useDisposable';
import type { DrivingTier } from '../../quality';
import { CURB_HEIGHT } from '../ground/slabs';
import { buildingGeometry } from './buildingGeometry';
import { createFacadeMaterial } from './facadeMaterial';
import { layoutBuildings, type Courtyard } from './layout';
import { rooftopGeometry } from './rooftops';
import { withHaze } from '../../world/atmosphere';

/** Lawns in the block courtyards, just above the paving. */
function lawnGeometry(courtyards: Courtyard[]): THREE.BufferGeometry {
  const parts = courtyards
    .filter((c) => c.x1 - c.x0 > 3 && c.y1 - c.y0 > 3)
    .map((c) => new THREE.PlaneGeometry(c.x1 - c.x0, c.y1 - c.y0).rotateX(-Math.PI / 2).translate((c.x0 + c.x1) / 2, CURB_HEIGHT + 0.01, -(c.y0 + c.y1) / 2));
  const g = new THREE.BufferGeometry();
  if (!parts.length) return g;
  const pos: number[] = [];
  const nor: number[] = [];
  for (const p of parts) {
    const n = p.toNonIndexed();
    pos.push(...(n.attributes.position.array as Float32Array));
    nor.push(...(n.attributes.normal.array as Float32Array));
    p.dispose();
    n.dispose();
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/**
 * Every building in the city in one draw call, plus their rooftop plant
 * and the lawns in the courtyards. Buildings cast the long late afternoon
 * shadows across the streets.
 */
export function Buildings({ city, tier, shadows }: { city: City; tier: DrivingTier; shadows: boolean }) {
  const geo = useDisposable(() => {
    const { buildings, courtyards } = layoutBuildings(city);
    const parts = { walls: buildingGeometry(city, buildings), roofs: rooftopGeometry(buildings), lawns: lawnGeometry(courtyards) };
    return { ...parts, dispose: () => Object.values(parts).forEach((g) => g.dispose()) };
  }, [city]);
  const mat = useDisposable(() => {
    const facade = createFacadeMaterial(tier);
    const plant = withHaze(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.15 }));
    const lawn = withHaze(new THREE.MeshStandardMaterial({ color: '#4d6b34', roughness: 0.95 }));
    return { facade, plant, lawn, dispose: () => [facade, plant, lawn].forEach((m) => m.dispose()) };
  }, [tier]);
  return (
    <group>
      <mesh geometry={geo.walls} material={mat.facade} castShadow={shadows} receiveShadow={shadows} />
      <mesh geometry={geo.roofs} material={mat.plant} castShadow={shadows} receiveShadow={shadows} />
      <mesh geometry={geo.lawns} material={mat.lawn} receiveShadow={shadows} />
    </group>
  );
}
