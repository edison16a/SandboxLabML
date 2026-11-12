import { CAR_HATCH, CAR_SEDAN, CAR_TAXI, CAR_VAN } from '@/engine/driving/world/state';
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
