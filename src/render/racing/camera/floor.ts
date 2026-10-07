import type * as THREE from 'three';
import { padOf, padWeight, type Pad } from '../stadium/layout';
import { terrainHeight } from '../world/terrain/terrainHeight';
import type { WorldData } from '../world/worldData';

/** Roof height of the stands and the pits, m: a camera over their footprint stays above it. */
const ROOFS = { stand: 13.5, pit: 9.6 };

/** Each world's building footprints with their roof heights, worked out once. */
const footprints = new WeakMap<WorldData, Array<[Pad, number]>>();

function roofsOf(world: WorldData): Array<[Pad, number]> {
  let list = footprints.get(world);
  if (!list) {
    const l = world.layout;
    list = l.stands.map((s) => [padOf(l, l.side, s, 1), ROOFS.stand] as [Pad, number]);
    if (l.pit) list.push([padOf(l, -l.side, l.pit, 1), ROOFS.pit]);
    footprints.set(world, list);
  }
  return list;
}

/** Height of whatever is under (x, z): the ground, or a building's roof. */
function floorAt(world: WorldData, x: number, z: number): number {
  let floor = terrainHeight(world.shape, x, z);
  const roofs = roofsOf(world);
  // Plain index loop: this runs every frame and should not build iterators.
  for (let k = 0; k < roofs.length; k++) if (padWeight(roofs[k][0], x, z, 0.01) > 0.5) floor = Math.max(floor, roofs[k][1]);
  return floor;
}

/** Keeps a camera at least `margin` meters over the ground or roof beneath it, so it never sinks into a hill or a grandstand. */
export function keepAboveGround(camera: THREE.Camera, world: WorldData | null, margin: number): boolean {
  const ground = world ? floorAt(world, camera.position.x, camera.position.z) : 0;
  if (camera.position.y >= ground + margin) return false;
  camera.position.y = ground + margin;
  return true;
}
