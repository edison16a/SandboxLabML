import type { ArenaLayout, HideSeekLayoutId } from './types';

const QUARTER = Math.PI / 2;

/**
 * The built-in rooms. All share the 20 x 20 m outer walls, so x and z run
 * from -10 to 10. Box spots keep at least a meter of clearance from walls,
 * which leaves room for the spawn jitter.
 */
export const OPEN_LAYOUT: ArenaLayout = {
  id: 'open',
  name: 'Open room',
  description: 'An empty room. The only cover is what the hider builds.',
  walls: [],
  boxes: [
    { x: -4, z: 4, yaw: 0 },
    { x: 4, z: -4, yaw: 0 },
    { x: -4, z: -4, yaw: 0 },
    { x: 4, z: 4, yaw: QUARTER },
  ],
  hiderSpawn: { minX: -8, maxX: -2, minZ: -3, maxZ: 3 },
  seekerSpawn: { minX: 2, maxX: 8, minZ: -3, maxZ: 3 },
};

/**
 * An L-shaped wall closes off the far left corner as a 7 x 7 m half room.
 * Its doorway is 1.6 m wide, so one plank seals it.
 */
export const SHELTER_LAYOUT: ArenaLayout = {
  id: 'shelter',
  name: 'Shelter',
  description: 'A half room in the corner with one doorway. A plank can close it.',
  walls: [
    { from: [-3, -10], to: [-3, -3] },
    { from: [-10, -3], to: [-7.2, -3] },
    { from: [-5.4, -3], to: [-3, -3] },
  ],
  boxes: [
    { x: -6.5, z: -6.5, yaw: 0 },
    { x: 3, z: -5, yaw: 0 },
    { x: -6.3, z: -1.5, yaw: 0 },
    { x: 4, z: 5, yaw: QUARTER },
  ],
  hiderSpawn: { minX: -2, maxX: 2, minZ: 0, maxZ: 4 },
  seekerSpawn: { minX: 5, maxX: 9, minZ: 5, maxZ: 9 },
};

/**
 * Three long walls fold the room into four lanes joined by 2.9 m gaps at
 * alternating ends. The teams start in neighboring lanes with a wall
 * between them. Used by the benchmark.
 */
export const CORRIDOR_LAYOUT: ArenaLayout = {
  id: 'corridor',
  name: 'Corridors',
  description: 'Four lanes joined at alternating ends. Planks can close the gaps.',
  walls: [
    { from: [-10, -5], to: [7, -5] },
    { from: [-7, 0], to: [10, 0] },
    { from: [-10, 5], to: [7, 5] },
  ],
  boxes: [
    { x: -5, z: -7.5, yaw: 0 },
    { x: 5, z: 7.5, yaw: 0 },
    { x: 0, z: -2.5, yaw: 0 },
    { x: 0, z: 2.5, yaw: 0 },
  ],
  hiderSpawn: { minX: -8, maxX: -2.5, minZ: -4, maxZ: -1 },
  seekerSpawn: { minX: 2.5, maxX: 8, minZ: 1, maxZ: 4 },
};

export const HIDESEEK_LAYOUTS: Record<HideSeekLayoutId, ArenaLayout> = {
  open: OPEN_LAYOUT,
  shelter: SHELTER_LAYOUT,
  corridor: CORRIDOR_LAYOUT,
};

export const HIDESEEK_LAYOUT_IDS = Object.keys(HIDESEEK_LAYOUTS) as HideSeekLayoutId[];

export function getLayout(id: HideSeekLayoutId): ArenaLayout {
  const layout = HIDESEEK_LAYOUTS[id];
  if (!layout) throw new Error(`Unknown Hide and Seek layout "${id}".`);
  return layout;
}
