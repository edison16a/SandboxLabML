import { Rng } from '../../core/rng';
import type { CitySpec } from './types';

/**
 * The built in cities. Midtown is where runs train by default. Harbor and
 * Old Town are held out: the benchmark drives champions there, on streets
 * they have never seen, so a score means the brain learned to drive rather
 * than learning one map by heart.
 */
export const BUILT_IN_CITIES: readonly CitySpec[] = [
  { id: 'midtown', name: 'Midtown', columns: [78, 70, 86, 70, 78], rows: [72, 84, 66, 84, 72], seed: 1307, slow: { vertical: [1], horizontal: [4] } },
  { id: 'harbor', name: 'Harbor', columns: [92, 64, 74, 64, 92], rows: [70, 96, 70, 60], seed: 2711, slow: { vertical: [3], horizontal: [0] } },
  { id: 'old-town', name: 'Old Town', columns: [60, 68, 60, 68, 60, 68], rows: [64, 58, 72, 58, 64], seed: 4099, slow: { vertical: [2, 4], horizontal: [2] } },
];

export const DEFAULT_CITY_ID = 'midtown';
/** Cities the benchmark keeps for itself. */
export const HELD_OUT_CITY_IDS = ['harbor', 'old-town'] as const;

export function builtInCity(id: string): CitySpec | undefined {
  return BUILT_IN_CITIES.find((c) => c.id === id);
}

/**
 * A fresh city from a seed: 4 to 6 blocks a side of mixed sizes, with a
 * slow zone or two. Same seed, same city.
 */
export function randomCitySpec(seed: number): CitySpec {
  const rng = new Rng(seed ^ 0xc17e);
  const size = () => Math.round(rng.range(58, 96));
  const cols = 4 + rng.int(3);
  const rows = 4 + rng.int(3);
  return {
    id: `random-${seed >>> 0}`,
    name: 'Random city',
    columns: Array.from({ length: cols }, size),
    rows: Array.from({ length: rows }, size),
    seed: seed >>> 0,
    slow: { vertical: [rng.int(cols + 1)], horizontal: rng.chance(0.5) ? [rng.int(rows + 1)] : [] },
  };
}
