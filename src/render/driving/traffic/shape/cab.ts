import { CAR_DIMENSIONS, CAR_TAXI } from '@/engine/driving/world/state';
import { SALOON_BASE, saloonDecals } from './saloon';
import type { CarShape } from './types';

const [length, width] = CAR_DIMENSIONS[CAR_TAXI];

/** The cab: the saloon in the taxi's footprint, with a slim lit sign on the roof. */
const CAB_BASE: CarShape = { ...SALOON_BASE, kind: CAR_TAXI, length, width, track: width / 2 - 0.135, roofSign: true };

export const CAB: CarShape = { ...CAB_BASE, decals: saloonDecals(CAB_BASE) };
