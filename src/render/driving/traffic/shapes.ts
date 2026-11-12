import { CAR_HATCH, CAR_KINDS, CAR_SEDAN, CAR_TAXI, CAR_VAN } from '@/engine/driving/world/state';
import { CAB } from './shape/cab';
import { HATCH } from './shape/hatch';
import { SALOON } from './shape/saloon';
import type { CarShape } from './shape/types';
import { VAN } from './shape/van';

export type { CarShape } from './shape/types';

/** Every traffic body type by its kind code in the world snapshot. */
export const CAR_SHAPES: Record<number, CarShape> = {
  [CAR_SEDAN]: SALOON,
  [CAR_HATCH]: HATCH,
  [CAR_VAN]: VAN,
  [CAR_TAXI]: CAB,
};

/** How far the cab's roof sign (foot and box) stands above its roof, m. */
const SIGN_RISE = 0.16;

/**
 * The highest point of each body type above the road, by kind code, m.
 * Overlays that hang above a car (its distance label, the top of its
 * detection box) start from here, so a tall van never swallows them.
 */
export const CAR_ROOF: Float32Array = (() => {
  const roof = new Float32Array(CAR_KINDS);
  for (let k = 0; k < CAR_KINDS; k++) {
    const s = CAR_SHAPES[k];
    roof[k] = Math.max(...s.top.map(([, y]) => y)) + (s.roofSign ? SIGN_RISE : 0);
  }
  return roof;
})();
